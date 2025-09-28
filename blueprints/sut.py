from flask import Blueprint, jsonify, request, session
from decorators import login_required, lisans_kontrolu, modification_allowed
from extensions import supabase, turkey_tz
from decimal import Decimal, InvalidOperation
from utils import parse_supabase_timestamp # <-- DEĞİŞİKLİK BURADA
import logging
from datetime import datetime

sut_bp = Blueprint('sut', __name__, url_prefix='/api')
logger = logging.getLogger(__name__)

def get_guncel_ozet(sirket_id, tarih_str):
    try:
        response = supabase.rpc('get_daily_summary_rpc', {
            'target_sirket_id': sirket_id,
            'target_date': tarih_str
        }).execute()
        if response.data:
            summary = response.data[0]
            summary['toplam_litre'] = round(float(summary.get('toplam_litre', 0)), 2)
            return summary
    except Exception as e:
        logger.error(f"RPC ile özet çekilirken hata: {e}", exc_info=True)
    return {'toplam_litre': 0, 'girdi_sayisi': 0}

@sut_bp.route('/sut_girdileri', methods=['GET'])
@login_required
def get_sut_girdileri():
    try:
        sirket_id = session['user']['sirket_id']
        secilen_tarih_str = request.args.get('tarih')
        sayfa = int(request.args.get('sayfa', 1))
        limit = 6
        offset = (sayfa - 1) * limit
        
        query = supabase.table('sut_girdileri').select(
            'id,litre,fiyat,taplanma_tarihi,duzenlendi_mi,kullanicilar(kullanici_adi),tedarikciler(isim)', 
            count='exact'
        ).eq('sirket_id', sirket_id)
        
        if secilen_tarih_str:
            target_date = datetime.strptime(secilen_tarih_str, '%Y-%m-%d').date()
            start_utc = turkey_tz.localize(datetime.combine(target_date, datetime.min.time())).astimezone(pytz.utc).isoformat()
            end_utc = turkey_tz.localize(datetime.combine(target_date, datetime.max.time())).astimezone(pytz.utc).isoformat()
            query = query.gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc)
            
        data = query.order('id', desc=True).range(offset, offset + limit - 1).execute()
        return jsonify({"girdiler": data.data, "toplam_girdi_sayisi": data.count})
    except Exception as e:
        logger.error(f"Süt girdileri listeleme hatası: {e}", exc_info=True)
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@sut_bp.route('/sut_girdisi_ekle', methods=['POST'])
@login_required
@lisans_kontrolu
@modification_allowed
def add_sut_girdisi():
    try:
        yeni_girdi = request.get_json()
        litre = Decimal(yeni_girdi.get('litre'))
        fiyat = Decimal(yeni_girdi.get('fiyat'))
        
        if litre <= 0 or fiyat <= 0:
            return jsonify({"error": "Litre ve fiyat pozitif bir değer olmalıdır."}), 400
            
        data = supabase.table('sut_girdileri').insert({
            'tedarikci_id': yeni_girdi['tedarikci_id'], 
            'litre': str(litre),
            'fiyat': str(fiyat),
            'kullanici_id': session['user']['id'], 
            'sirket_id': session['user']['sirket_id']
        }).execute()
        
        bugun_str = datetime.now(turkey_tz).date().isoformat()
        yeni_ozet = get_guncel_ozet(session['user']['sirket_id'], bugun_str)
        
        return jsonify({"status": "success", "data": data.data, "yeni_ozet": yeni_ozet})
    except (InvalidOperation, TypeError, ValueError):
        return jsonify({"error": "Lütfen geçerli bir litre ve fiyat değeri girin."}), 400
    except Exception as e:
        logger.error(f"Süt girdisi ekleme hatası: {e}", exc_info=True)
        return jsonify({"error": "Sunucuda bir hata oluştu."}), 500

@sut_bp.route('/sut_girdisi_duzenle/<int:girdi_id>', methods=['PUT'])
@login_required
@lisans_kontrolu
@modification_allowed
def update_sut_girdisi(girdi_id):
    try:
        data = request.get_json()
        mevcut_girdi_res = supabase.table('sut_girdileri').select('*').eq('id', girdi_id).eq('sirket_id', session['user']['sirket_id']).single().execute()
        if not mevcut_girdi_res.data:
             return jsonify({"error": "Girdi bulunamadı veya bu işlem için yetkiniz yok."}), 404
        
        girdi_tarihi = parse_supabase_timestamp(mevcut_girdi_res.data['taplanma_tarihi'])
        girdi_tarihi_str = girdi_tarihi.astimezone(turkey_tz).date().isoformat() if girdi_tarihi else datetime.now(turkey_tz).date().isoformat()

        supabase.table('girdi_gecmisi').insert({
            'orijinal_girdi_id': girdi_id, 
            'duzenleyen_kullanici_id': session['user']['id'], 
            'duzenleme_sebebi': data['duzenleme_sebebi'], 
            'eski_litre_degeri': mevcut_girdi_res.data['litre'], 
            'eski_fiyat_degeri': mevcut_girdi_res.data.get('fiyat'), 
            'eski_tedarikci_id': mevcut_girdi_res.data['tedarikci_id']
        }).execute()
        
        guncel_girdi = supabase.table('sut_girdileri').update({
            'litre': data['yeni_litre'],
            'duzenlendi_mi': True
        }).eq('id', girdi_id).execute()
        
        yeni_ozet = get_guncel_ozet(session['user']['sirket_id'], girdi_tarihi_str)
        
        return jsonify({"status": "success", "data": guncel_girdi.data, "yeni_ozet": yeni_ozet})
    except Exception as e:
        logger.error(f"Süt girdisi düzenleme hatası: {e}", exc_info=True)
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@sut_bp.route('/sut_girdisi_sil/<int:girdi_id>', methods=['DELETE'])
@login_required
@lisans_kontrolu
@modification_allowed
def delete_sut_girdisi(girdi_id):
    try:
        mevcut_girdi_res = supabase.table('sut_girdileri').select('sirket_id, taplanma_tarihi').eq('id', girdi_id).eq('sirket_id', session['user']['sirket_id']).single().execute()
        if not mevcut_girdi_res.data:
             return jsonify({"error": "Girdi bulunamadı veya silme yetkiniz yok."}), 404
        
        girdi_tarihi = parse_supabase_timestamp(mevcut_girdi_res.data['taplanma_tarihi'])
        girdi_tarihi_str = girdi_tarihi.astimezone(turkey_tz).date().isoformat() if girdi_tarihi else datetime.now(turkey_tz).date().isoformat()

        supabase.table('girdi_gecmisi').delete().eq('orijinal_girdi_id', girdi_id).execute()
        supabase.table('sut_girdileri').delete().eq('id', girdi_id).execute()
        
        yeni_ozet = get_guncel_ozet(session['user']['sirket_id'], girdi_tarihi_str)
        
        return jsonify({"message": "Girdi başarıyla silindi.", "yeni_ozet": yeni_ozet}), 200
    except Exception as e:
        logger.error(f"Süt girdisi silme hatası: {e}", exc_info=True)
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@sut_bp.route('/girdi_gecmisi/<int:girdi_id>')
@login_required
def get_girdi_gecmisi(girdi_id):
    try:
        original_girdi_response = supabase.table('sut_girdileri').select('sirket_id').eq('id', girdi_id).eq('sirket_id', session['user']['sirket_id']).single().execute()
        if not original_girdi_response.data:
            return jsonify({"error": "Yetkisiz erişim veya girdi bulunamadı."}), 403
        
        gecmis_data = supabase.table('girdi_gecmisi').select('*,duzenleyen_kullanici_id(kullanici_adi)').eq('orijinal_girdi_id', girdi_id).order('created_at', desc=True).execute()
        return jsonify(gecmis_data.data)
    except Exception as e:
        logger.error(f"Girdi geçmişi hatası: {e}", exc_info=True)
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500
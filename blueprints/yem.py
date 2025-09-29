import logging
from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required, lisans_kontrolu, modification_allowed
from extensions import supabase
from datetime import datetime
from decimal import Decimal, InvalidOperation

# Logging yapılandırması
logger = logging.getLogger(__name__)

yem_bp = Blueprint('yem', __name__, url_prefix='/yem')

# --- ARAYÜZ SAYFALARI ---
@yem_bp.route('/yonetim')
@login_required
@lisans_kontrolu
def yem_yonetimi_sayfasi():
    return render_template('yem_yonetimi.html')

# --- API UÇ NOKTALARI ---
@yem_bp.route('/api/urunler/liste', methods=['GET'])
@login_required
def get_yem_urunleri_listesi():
    try:
        sirket_id = session['user']['sirket_id']
        # Sayfalama olmadan, sadece menü için gerekli alanları çekiyoruz
        urunler = supabase.table('yem_urunleri').select(
            'id, yem_adi, stok_miktari_kg'
        ).eq('sirket_id', sirket_id).order('yem_adi').execute()
        return jsonify(urunler.data)
    except Exception as e:
        logger.error(f"Yem ürün listesi çekilirken hata: {e}", exc_info=True)
        return jsonify({"error": "Ürün listesi alınamadı."}), 500



@yem_bp.route('/api/urunler', methods=['GET'])
@login_required
def get_yem_urunleri():
    try:
        sirket_id = session['user']['sirket_id']
        sayfa = int(request.args.get('sayfa', 1))
        limit = 10 # Sayfa başına gösterilecek ürün sayısı
        offset = (sayfa - 1) * limit

        # Sorguya hem sayfalama hem de toplam kayıt sayısını alacak şekilde güncelleme yapıyoruz
        query = supabase.table('yem_urunleri').select(
            '*', count='exact'  # count='exact' toplam ürün sayısını verir
        ).eq('sirket_id', sirket_id).order(
            'yem_adi'
        ).range(
            offset, offset + limit - 1
        )
        
        response = query.execute()

        # Frontend'e hem ürünleri hem de toplam sayıyı gönderiyoruz
        return jsonify({
            "urunler": response.data,
            "toplam_urun_sayisi": response.count
        })

    except Exception as e:
        logger.error(f"Yem ürünleri listelenirken hata oluştu: {e}", exc_info=True)
        return jsonify({"error": "Ürünler listelenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/urunler', methods=['POST'])
@login_required
@modification_allowed
def add_yem_urunu():
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        
        yem_adi = data.get('yem_adi')
        stok = data.get('stok_miktari_kg')
        fiyat = data.get('birim_fiyat')

        if not yem_adi or stok is None or fiyat is None:
            return jsonify({"error": "Lütfen tüm alanları doldurun."}), 400

        yeni_urun = {
            "sirket_id": sirket_id,
            "yem_adi": yem_adi,
            "stok_miktari_kg": str(Decimal(stok)),
            "birim_fiyat": str(Decimal(fiyat))
        }
        supabase.table('yem_urunleri').insert(yeni_urun).execute()
        return jsonify({"message": "Yeni yem ürünü başarıyla eklendi."}), 201
    except (InvalidOperation, TypeError):
        return jsonify({"error": "Lütfen stok ve fiyat için geçerli sayılar girin."}), 400
    except Exception as e:
        logger.error(f"Yem ürünü eklenirken hata oluştu: {e}", exc_info=True)
        return jsonify({"error": "Ürün eklenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/urunler/<int:id>', methods=['PUT'])
@login_required
@modification_allowed
def update_yem_urunu(id):
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        
        guncel_veri = {
            "yem_adi": data.get('yem_adi'),
            "stok_miktari_kg": str(Decimal(data.get('stok_miktari_kg'))),
            "birim_fiyat": str(Decimal(data.get('birim_fiyat')))
        }
        
        # --- GÜVENLİK GÜNCELLEMESİ ---
        response = supabase.table('yem_urunleri').update(guncel_veri).eq('id', id).eq('sirket_id', sirket_id).execute()

        if not response.data:
            return jsonify({"error": "Yem ürünü bulunamadı veya bu işlem için yetkiniz yok."}), 404
            
        return jsonify({"message": "Yem ürünü başarıyla güncellendi."})
    except (InvalidOperation, TypeError):
        return jsonify({"error": "Lütfen stok ve fiyat için geçerli sayılar girin."}), 400
    except Exception as e:
        logger.error(f"Yem ürünü güncellenirken hata oluştu: {e}", exc_info=True)
        return jsonify({"error": "Güncelleme sırasında bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/urunler/<int:id>', methods=['DELETE'])
@login_required
@modification_allowed
def delete_yem_urunu(id):
    try:
        sirket_id = session['user']['sirket_id']

        # --- GÜVENLİK GÜNCELLEMESİ ---
        response = supabase.table('yem_urunleri').delete().eq('id', id).eq('sirket_id', sirket_id).execute()
        
        if not response.data:
            return jsonify({"error": "Yem ürünü bulunamadı veya bu işlem için yetkiniz yok."}), 404

        return jsonify({"message": "Yem ürünü başarıyla silindi."})
    except Exception as e:
        if 'violates foreign key constraint' in str(e).lower():
            return jsonify({"error": "Bu yeme ait çıkış işlemleri olduğu için silinemiyor."}), 409
        logger.error(f"Yem ürünü silinirken hata oluştu: {e}", exc_info=True)
        return jsonify({"error": "Silme işlemi sırasında bir hata oluştu."}), 500

@yem_bp.route('/api/islemler', methods=['POST'])
@login_required
@modification_allowed
def add_yem_islemi():
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']
        
        yem_urun_id = data.get('yem_urun_id')
        tedarikci_id = data.get('tedarikci_id')
        
        try:
            miktar_kg = Decimal(data.get('miktar_kg'))
            if miktar_kg <= 0: return jsonify({"error": "Miktar pozitif bir değer olmalıdır."}), 400
        except (InvalidOperation, TypeError):
             return jsonify({"error": "Lütfen miktar için geçerli bir sayı girin."}), 400

        if not yem_urun_id or not tedarikci_id:
             return jsonify({"error": "Tedarikçi ve yem ürünü seçimi zorunludur."}), 400

        urun_res = supabase.table('yem_urunleri').select('stok_miktari_kg, birim_fiyat').eq('id', yem_urun_id).eq('sirket_id', sirket_id).single().execute()
        if not urun_res.data: return jsonify({"error": "Yem ürünü bulunamadı veya bu şirkete ait değil."}), 404
            
        mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
        birim_fiyat = Decimal(urun_res.data['birim_fiyat'])

        if mevcut_stok < miktar_kg: return jsonify({"error": f"Yetersiz stok! Mevcut stok: {mevcut_stok} kg"}), 400

        toplam_tutar = miktar_kg * birim_fiyat
        yeni_islem = {
            "sirket_id": sirket_id, "tedarikci_id": tedarikci_id,
            "yem_urun_id": yem_urun_id, "kullanici_id": kullanici_id,
            "miktar_kg": str(miktar_kg),
            "islem_anindaki_birim_fiyat": str(birim_fiyat),
            "toplam_tutar": str(toplam_tutar),
            "aciklama": data.get('aciklama')
        }
        supabase.table('yem_islemleri').insert(yeni_islem).execute()

        yeni_stok = mevcut_stok - miktar_kg
        supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}).eq('id', yem_urun_id).execute()

        return jsonify({"message": "Yem çıkışı başarıyla kaydedildi."}), 201
    except Exception as e:
        logger.error(f"Yem işlemi eklenirken hata oluştu: {e}", exc_info=True)
        return jsonify({"error": "İşlem sırasında bir hata oluştu."}), 500
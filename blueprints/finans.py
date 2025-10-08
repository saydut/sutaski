import logging
from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required, lisans_kontrolu, modification_allowed
from extensions import supabase
from datetime import datetime
from decimal import Decimal, InvalidOperation
from constants import FinansIslemTipi # <-- YENİ: Sabitleri içeri aktar

# Logging yapılandırması
logger = logging.getLogger(__name__)

finans_bp = Blueprint('finans', __name__, url_prefix='/finans')

# --- ARAYÜZ SAYFALARI ---
@finans_bp.route('/')
@login_required
@lisans_kontrolu
def finans_sayfasi():
    """Finansal işlemlerin listelendiği ana sayfa."""
    # Service Worker'ın uygulama kabuğunu önbelleğe alması için özel kontrol
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('finans_yonetimi.html', session={})
    return render_template('finans_yonetimi.html')

# --- API UÇ NOKTALARI ---

@finans_bp.route('/api/islemler', methods=['GET'])
@login_required
def get_finansal_islemler():
    """Şirkete ait tüm finansal işlemleri SAYFALAMALI olarak listeler."""
    try:
        sirket_id = session['user']['sirket_id']
        sayfa = int(request.args.get('sayfa', 1))
        limit = 5 # Sayfa başına 15 işlem gösterelim
        offset = (sayfa - 1) * limit

        query = supabase.table('finansal_islemler').select(
            '*, tedarikciler(isim)', count='estimated'
        ).eq('sirket_id', sirket_id).order(
            'islem_tarihi', desc=True
        ).range(offset, offset + limit - 1)
        
        response = query.execute()

        return jsonify({
            "islemler": response.data,
            "toplam_kayit": response.count
        })

    except Exception as e:
        logger.error(f"Finansal işlemler listelenirken hata oluştu: {e}", exc_info=True)
        return jsonify({"error": "İşlemler listelenirken bir sunucu hatası oluştu."}), 500


@finans_bp.route('/api/islemler', methods=['POST'])
@login_required
@modification_allowed
def add_finansal_islem():
    """Yeni bir avans veya ödeme işlemi ekler."""
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']

        islem_tipi = data.get('islem_tipi')
        tedarikci_id = data.get('tedarikci_id')
        tutar = data.get('tutar')
        
        if not all([islem_tipi, tedarikci_id, tutar]):
            return jsonify({"error": "Lütfen tüm zorunlu alanları doldurun."}), 400
        
        # DEĞİŞİKLİK: 'Ödeme' ve 'Avans' yerine FinansIslemTipi sabitlerini kullan
        gecerli_tipler = [tip.value for tip in FinansIslemTipi]
        if islem_tipi not in gecerli_tipler:
            return jsonify({"error": "Geçersiz işlem tipi."}), 400

        try:
            tutar_decimal = Decimal(tutar)
            if tutar_decimal <= 0:
                return jsonify({"error": "Tutar pozitif bir değer olmalıdır."}), 400
        except (InvalidOperation, TypeError):
            return jsonify({"error": "Lütfen tutar için geçerli bir sayı girin."}), 400

        yeni_islem = {
            "sirket_id": sirket_id,
            "tedarikci_id": tedarikci_id,
            "kullanici_id": kullanici_id,
            "islem_tipi": islem_tipi,
            "tutar": str(tutar_decimal),
            "aciklama": data.get('aciklama') or None,
            "islem_tarihi": data.get('islem_tarihi')
        }
        
        if not yeni_islem["islem_tarihi"]:
            del yeni_islem["islem_tarihi"]

        supabase.table('finansal_islemler').insert(yeni_islem).execute()
        
        return jsonify({"message": f"{islem_tipi} işlemi başarıyla kaydedildi."}), 201

    except Exception as e:
        logger.error(f"Finansal işlem eklenirken hata oluştu: {e}", exc_info=True)
        return jsonify({"error": "İşlem sırasında bir sunucu hatası oluştu."}), 500

@finans_bp.route('/api/islemler/<int:islem_id>', methods=['PUT'])
@login_required
@modification_allowed
def update_finansal_islem(islem_id):
    """Mevcut bir finansal işlemi günceller."""
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        
        guncellenecek_veri = {}
        if 'tutar' in data:
            try:
                tutar_decimal = Decimal(data['tutar'])
                if tutar_decimal <= 0: return jsonify({"error": "Tutar pozitif olmalıdır."}), 400
                guncellenecek_veri['tutar'] = str(tutar_decimal)
            except (InvalidOperation, TypeError):
                return jsonify({"error": "Geçerli bir tutar girin."}), 400

        if 'aciklama' in data:
            guncellenecek_veri['aciklama'] = data['aciklama'].strip() or None

        if not guncellenecek_veri:
            return jsonify({"error": "Güncellenecek veri bulunamadı."}), 400

        # Sorguya sirket_id eklenerek güvenlik artırıldı
        response = supabase.table('finansal_islemler').update(guncellenecek_veri).eq('id', islem_id).eq('sirket_id', sirket_id).execute()
        
        if not response.data:
            return jsonify({"error": "İşlem bulunamadı veya bu işlem için yetkiniz yok."}), 404

        return jsonify({"message": "İşlem başarıyla güncellendi."})

    except Exception as e:
        logger.error(f"Finansal işlem güncellenirken hata oluştu: {e}", exc_info=True)
        return jsonify({"error": "Güncelleme sırasında bir sunucu hatası oluştu."}), 500

@finans_bp.route('/api/islemler/<int:islem_id>', methods=['DELETE'])
@login_required
@modification_allowed
def delete_finansal_islem(islem_id):
    """Bir finansal işlemi siler."""
    try:
        sirket_id = session['user']['sirket_id']
        
        response = supabase.table('finansal_islemler').delete().eq('id', islem_id).eq('sirket_id', sirket_id).execute()

        if not response.data:
            return jsonify({"error": "İşlem bulunamadı veya bu işlem için yetkiniz yok."}), 404

        return jsonify({"message": "İşlem başarıyla silindi."})
    except Exception as e:
        logger.error(f"Finansal işlem silinirken hata oluştu: {e}", exc_info=True)
        return jsonify({"error": "Silme işlemi sırasında bir hata oluştu."}), 500
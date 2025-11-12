# blueprints/sut.py (SERVİS KATMANINI KULLANACAK ŞEKİLDE GÜNCELLENDİ)

from flask import Blueprint, jsonify, request, session, g
from decorators import login_required, lisans_kontrolu, modification_allowed
from extensions import turkey_tz
import logging
from datetime import datetime

# YENİ: Veritabanı mantığını içeren servis dosyasını import ediyoruz
from services.sut_service import sut_service

sut_bp = Blueprint('sut', __name__, url_prefix='/api')
logger = logging.getLogger(__name__)

@sut_bp.route('/sut_girdileri', methods=['GET'])
@login_required
def get_sut_girdileri():
    """Süt girdilerini servis üzerinden listeler."""
    try:
        # GÜNCELLEME: Session'dan sadece sirket_id'yi değil, kullanıcı bilgilerini de alıyoruz.
        user_info = session['user']
        sirket_id = user_info['sirket_id']
        kullanici_id = user_info['id']
        rol = user_info['rol']
        
        secilen_tarih_str = request.args.get('tarih')
        sayfa = int(request.args.get('sayfa', 1))
        
        # GÜNCELLEME: Servis fonksiyonunu yeni parametrelerle (kullanici_id, rol) çağırıyoruz.
        girdiler, toplam_sayi = sut_service.get_paginated_list(sirket_id, kullanici_id, rol, secilen_tarih_str, sayfa)
        
        return jsonify({"girdiler": girdiler, "toplam_girdi_sayisi": toplam_sayi})
    except Exception as e:
        logger.error(f"Süt girdileri listeleme hatası: {e}", exc_info=True)
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@sut_bp.route('/sut_girdisi_ekle', methods=['POST'])
@login_required
@lisans_kontrolu
@modification_allowed
def add_sut_girdisi():
    """Yeni bir süt girdisi eklemek için servisi çağırır."""
    try:
        yeni_girdi = request.get_json()
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']

        data = sut_service.add_entry(sirket_id, kullanici_id, yeni_girdi)
        
        # Güncel özet, arayüzün anında güncellenmesi için hala gerekli
        bugun_str = datetime.now(turkey_tz).date().isoformat()
        yeni_ozet = sut_service.get_daily_summary(sirket_id, bugun_str)
        
        return jsonify({"status": "success", "data": data, "yeni_ozet": yeni_ozet})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Süt girdisi ekleme hatası: {e}", exc_info=True)
        return jsonify({"error": "Sunucuda bir hata oluştu."}), 500

@sut_bp.route('/sut_girdisi_duzenle/<int:girdi_id>', methods=['PUT'])
@login_required
@lisans_kontrolu
@modification_allowed
def update_sut_girdisi(girdi_id):
    """Bir süt girdisini düzenlemek için servisi çağırır."""
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']
        
        guncel_girdi, girdi_tarihi_str = sut_service.update_entry(girdi_id, sirket_id, kullanici_id, data)
        
        yeni_ozet = sut_service.get_daily_summary(sirket_id, girdi_tarihi_str)
        
        return jsonify({"status": "success", "data": guncel_girdi, "yeni_ozet": yeni_ozet})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Süt girdisi düzenleme hatası: {e}", exc_info=True)
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@sut_bp.route('/sut_girdisi_sil/<int:girdi_id>', methods=['DELETE'])
@login_required
@lisans_kontrolu
@modification_allowed
def delete_sut_girdisi(girdi_id):
    """Bir süt girdisini silmek için servisi çağırır."""
    try:
        sirket_id = session['user']['sirket_id']
        girdi_tarihi_str = sut_service.delete_entry(girdi_id, sirket_id)
        
        yeni_ozet = sut_service.get_daily_summary(sirket_id, girdi_tarihi_str)
        
        return jsonify({"message": "Girdi başarıyla silindi.", "yeni_ozet": yeni_ozet}), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"Süt girdisi silme hatası: {e}", exc_info=True)
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@sut_bp.route('/girdi_gecmisi/<int:girdi_id>')
@login_required
def get_girdi_gecmisi(girdi_id):
    """Bir girdinin düzenleme geçmişini servis üzerinden getirir."""
    try:
        sirket_id = session['user']['sirket_id']
        gecmis_data = sut_service.get_entry_history(girdi_id, sirket_id)
        return jsonify(gecmis_data)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 403
    except Exception as e:
        logger.error(f"Girdi geçmişi hatası: {e}", exc_info=True)
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@sut_bp.route('/tedarikci/<int:tedarikci_id>/son_fiyat', methods=['GET'])
@login_required
def get_son_fiyat(tedarikci_id):
    """Bir tedarikçi için girilen en son süt fiyatını döndürür."""
    try:
        sirket_id = session['user']['sirket_id']
        data = sut_service.get_last_price_for_supplier(sirket_id, tedarikci_id)
        return jsonify({"son_fiyat": data.get('fiyat')})
    except Exception as e:
        logger.error(f"Son fiyat API hatası: {e}", exc_info=True)
        return jsonify({"error": "Fiyat bilgisi alınamadı."}), 500

# --- AKILLI DOĞRULAMA İÇİN YENİ ENDPOINT ---
@sut_bp.route('/tedarikci/<int:tedarikci_id>/stats', methods=['GET'])
@login_required
def get_tedarikci_stats(tedarikci_id):
    """Bir tedarikçinin süt girdisi istatistiklerini getirir."""
    try:
        # YANLIŞ IMPORT SATIRI KALDIRILDI: from extensions import supabase
        sirket_id = session['user']['sirket_id']

        params = {
            'p_sirket_id': sirket_id,
            'p_tedarikci_id': tedarikci_id
        }
        # DOĞRU KULLANIM: g.supabase kullanılıyor
        response = g.supabase.rpc('get_supplier_stats', params).execute()

        if not response.data:
            # RPC fonksiyonu artık veri olmasa bile [{ "ortalama_litre": 0, "standart_sapma": 0 }] döndürmeli.
            # Ama yine de kontrol ekleyelim.
            logger.warning(f"get_supplier_stats RPC'den veri dönmedi. Parametreler: {params}")
            return jsonify([{"ortalama_litre": 0, "standart_sapma": 0}])

        return jsonify(response.data)
    except Exception as e:
        logger.error(f"İstatistik API hatası: {e}", exc_info=True)
        return jsonify({"error": "İstatistik verisi alınamadı."}), 500
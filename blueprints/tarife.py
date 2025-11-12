# blueprints/tarife.py

import logging
from flask import Blueprint, jsonify, render_template, request, session
# YENİ: Güvenlik için firma_yetkilisi_required ve modification_allowed decorator'larını import ediyoruz
from decorators import login_required, lisans_kontrolu, firma_yetkilisi_required, modification_allowed
# YENİ: Az önce oluşturduğumuz servisi import ediyoruz
from services.tarife_service import tarife_service

logger = logging.getLogger(__name__)
tarife_bp = Blueprint('tarife', __name__, url_prefix='/tarife')

# --- HTML Sayfası ---

@tarife_bp.route('/yonetim')
@login_required
@lisans_kontrolu
@firma_yetkilisi_required # Sadece firma yetkilisi ve admin bu sayfayı görebilir
def tarife_yonetim_sayfasi():
    """Süt fiyatı tarifelerinin yönetildiği arayüz sayfasını render eder."""
    return render_template('tarife_yonetimi.html')

# --- API Endpoint'leri ---

@tarife_bp.route('/api/listele', methods=['GET'])
@login_required
@firma_yetkilisi_required
def get_tarifeler_api():
    """Tüm tarifeleri listeler."""
    try:
        sirket_id = session['user']['sirket_id']
        tarifeler = tarife_service.get_all_tariffs(sirket_id)
        return jsonify(tarifeler)
    except Exception as e:
        logger.error(f"Tarife listeleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tarifeler listelenirken bir hata oluştu."}), 500

@tarife_bp.route('/api/ekle', methods=['POST'])
@login_required
@modification_allowed # Muhasebeci ekleyemez
@firma_yetkilisi_required
def add_tarife_api():
    """Yeni bir tarife ekler."""
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        yeni_tarife = tarife_service.add_tariff(sirket_id, data)
        return jsonify({"message": "Fiyat tarifesi başarıyla eklendi.", "tarife": yeni_tarife}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Tarife ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tarife eklenirken bir sunucu hatası oluştu."}), 500

@tarife_bp.route('/api/guncelle/<int:tarife_id>', methods=['PUT'])
@login_required
@modification_allowed # Muhasebeci güncelleyemez
@firma_yetkilisi_required
def update_tarife_api(tarife_id):
    """Bir tarifeyi günceller."""
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        guncel_tarife = tarife_service.update_tariff(sirket_id, tarife_id, data)
        return jsonify({"message": "Tarife başarıyla güncellendi.", "tarife": guncel_tarife})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Tarife güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tarife güncellenirken bir sunucu hatası oluştu."}), 500

@tarife_bp.route('/api/sil/<int:tarife_id>', methods=['DELETE'])
@login_required
@modification_allowed # Muhasebeci silemez
@firma_yetkilisi_required
def delete_tarife_api(tarife_id):
    """Bir tarifeyi siler."""
    try:
        sirket_id = session['user']['sirket_id']
        tarife_service.delete_tariff(sirket_id, tarife_id)
        return jsonify({"message": "Tarife başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"Tarife silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tarife silinirken bir sunucu hatası oluştu."}), 500

@tarife_bp.route('/api/get_fiyat', methods=['GET'])
@login_required
# NOT: Bu endpoint'e @firma_yetkilisi_required eklemiyoruz,
# çünkü toplayıcıların da ana panelde fiyatı çekebilmesi gerekiyor.
# @login_required olması yeterli.
def get_fiyat_api():
    """
    Belirli bir tarih için geçerli süt fiyatını getirir.
    Ana paneldeki süt girişi formu tarafından kullanılır.
    """
    try:
        sirket_id = session['user']['sirket_id']
        tarih_str = request.args.get('tarih') # 'YYYY-MM-DD'
        
        if not tarih_str:
            raise ValueError("Tarih parametresi zorunludur.")
            
        fiyat = tarife_service.get_fiyat_for_date(sirket_id, tarih_str)
        
        # fiyat None dönebilir (o tarih için tarife yoktur)
        return jsonify({"fiyat": fiyat})
        
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"API get_fiyat hatası: {e}", exc_info=True)
        return jsonify({"error": "Fiyat bilgisi alınamadı."}), 500
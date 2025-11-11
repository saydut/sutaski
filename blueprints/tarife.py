# blueprints/tarife.py

import logging
from flask import Blueprint, jsonify, render_template, request, g, flash
# 'session' import'u kaldırıldı
from decorators import login_required, role_required
# Yeni servis objemizi (instance) import ediyoruz
from services.tarife_service import tarife_service
from constants import UserRole # Rol sabitlerini kullanmak için

logger = logging.getLogger(__name__)
tarife_bp = Blueprint('tarife', __name__, url_prefix='/tarife')

# --- HTML Sayfası ---

@tarife_bp.route('/yonetim')
@login_required
@role_required('firma_admin') # Eski decorator'lar yerine
def tarife_yonetim_sayfasi():
    """Süt fiyatı tarifelerinin yönetildiği arayüz sayfasını render eder."""
    return render_template('tarife_yonetimi.html')

# --- API Endpoint'leri ---

@tarife_bp.route('/api/listele', methods=['GET'])
@login_required
@role_required('firma_admin')
def get_tarifeler_api():
    """Tüm tarifeleri RLS kullanarak listeler."""
    try:
        # sirket_id parametresi KALDIRILDI
        tarifeler, error = tarife_service.get_all_tariffs()
        if error:
            return jsonify({"error": error}), 500
        return jsonify(tarifeler)
    except Exception as e:
        logger.error(f"Tarife listeleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tarifeler listelenirken bir hata oluştu."}), 500

@tarife_bp.route('/api/ekle', methods=['POST'])
@login_required
@role_required('firma_admin')
def add_tarife_api():
    """Yeni bir tarife ekler. Servis, sirket_id'yi 'g' objesinden alır."""
    try:
        data = request.get_json()
        # sirket_id parametresi KALDIRILDI
        yeni_tarife, error = tarife_service.add_tariff(data)
        if error:
            return jsonify({"error": error}), 400
        return jsonify({"message": "Fiyat tarifesi başarıyla eklendi.", "tarife": yeni_tarife}), 201
    except Exception as e:
        logger.error(f"Tarife ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tarife eklenirken bir sunucu hatası oluştu."}), 500

@tarife_bp.route('/api/guncelle/<int:tarife_id>', methods=['PUT'])
@login_required
@role_required('firma_admin')
def update_tarife_api(tarife_id):
    """Bir tarifeyi RLS kullanarak günceller."""
    try:
        data = request.get_json()
        # sirket_id parametresi KALDIRILDI
        guncel_tarife, error = tarife_service.update_tariff(tarife_id, data)
        if error:
            return jsonify({"error": error}), 400
        return jsonify({"message": "Tarife başarıyla güncellendi.", "tarife": guncel_tarife})
    except Exception as e:
        logger.error(f"Tarife güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tarife güncellenirken bir sunucu hatası oluştu."}), 500

@tarife_bp.route('/api/sil/<int:tarife_id>', methods=['DELETE'])
@login_required
@role_required('firma_admin')
def delete_tarife_api(tarife_id):
    """Bir tarifeyi RLS kullanarak siler."""
    try:
        # sirket_id parametresi KALDIRILDI
        success, error = tarife_service.delete_tariff(tarife_id)
        if error:
            return jsonify({"error": error}), 404
        return jsonify({"message": "Tarife başarıyla silindi."})
    except Exception as e:
        logger.error(f"Tarife silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tarife silinirken bir sunucu hatası oluştu."}), 500

@tarife_bp.route('/api/get_fiyat', methods=['GET'])
@login_required
# Toplayıcı ve Admin bu rotayı kullanabilmeli
@role_required('firma_admin', 'toplayici')
def get_fiyat_api():
    """
    Belirli bir tarih için geçerli süt ALIŞ fiyatını RLS kullanarak getirir.
    Ana paneldeki süt girişi formu tarafından kullanılır.
    """
    try:
        tarih_str = request.args.get('tarih') # 'YYYY-MM-DD'
        
        if not tarih_str:
            raise ValueError("Tarih parametresi zorunludur.")
        
        # sirket_id parametresi KALDIRILDI
        # Servis, sirket_id'yi 'g' objesinden alacak
        fiyat, error = tarife_service.get_fiyat_for_date(tarih_str)
        
        if error:
            # Fiyat bulunamaması da bir 'error' olabilir
            return jsonify({"error": error, "fiyat": None}), 404
            
        return jsonify({"fiyat": fiyat})
        
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"API get_fiyat hatası: {e}", exc_info=True)
        return jsonify({"error": "Fiyat bilgisi alınamadı."}), 500
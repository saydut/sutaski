# blueprints/masraf.py

import logging
from flask import Blueprint, jsonify, render_template, request, g, flash
# 'session' import'u kaldırıldı
from decorators import login_required, role_required 
from services.masraf_service import masraf_service

logger = logging.getLogger(__name__)
masraf_bp = Blueprint('masraf', __name__, url_prefix='/masraf')

# --- HTML Sayfası ---

@masraf_bp.route('/yonetim')
@login_required
@role_required('firma_admin') # Sadece firma admini görebilir
def masraf_yonetim_sayfasi():
    """Genel Masraf Yönetimi sayfasını render eder."""
    # Kategori listesini forma eklemek için RLS ile çekiyoruz
    try:
        # Servis artık (data, error) döndürüyor
        kategoriler, error = masraf_service.get_all_categories()
        if error:
            flash(f"Kategoriler yüklenemedi: {error}", "danger")
            kategoriler = []
    except Exception as e:
        logger.error(f"Masraf sayfası kategori yükleme hatası: {e}", exc_info=True)
        flash("Kategoriler yüklenirken bir hata oluştu.", "danger")
        kategoriler = []
        
    return render_template('masraf_yonetimi.html', kategoriler=kategoriler)

# --- API Endpoint'leri : MASRAF KATEGORİLERİ ---

@masraf_bp.route('/api/kategori/listele', methods=['GET'])
@login_required
@role_required('firma_admin')
def get_kategoriler_api():
    """Tüm masraf kategorilerini RLS kullanarak listeler."""
    try:
        # sirket_id parametresi KALDIRILDI
        kategoriler, error = masraf_service.get_all_categories()
        if error:
            return jsonify({"error": error}), 500
        return jsonify(kategoriler)
    except Exception as e:
        logger.error(f"Kategori listeleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kategoriler listelenirken bir hata oluştu."}), 500

@masraf_bp.route('/api/kategori/ekle', methods=['POST'])
@login_required
@role_required('firma_admin')
def add_kategori_api():
    """Yeni bir masraf kategorisi ekler."""
    try:
        data = request.get_json()
        # sirket_id parametresi KALDIRILDI
        yeni_kategori, error = masraf_service.add_category(data)
        if error:
            return jsonify({"error": error}), 400
        return jsonify({"message": "Kategori başarıyla eklendi.", "kategori": yeni_kategori}), 201
    except Exception as e:
        logger.error(f"Kategori ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kategori eklenirken bir sunucu hatası oluştu."}), 500

@masraf_bp.route('/api/kategori/guncelle/<int:kategori_id>', methods=['PUT'])
@login_required
@role_required('firma_admin')
def update_kategori_api(kategori_id):
    """Bir masraf kategorisini RLS kullanarak günceller."""
    try:
        data = request.get_json()
        # sirket_id parametresi KALDIRILDI
        guncel_kategori, error = masraf_service.update_category(kategori_id, data)
        if error:
            return jsonify({"error": error}), 400
        return jsonify({"message": "Kategori başarıyla güncellendi.", "kategori": guncel_kategori})
    except Exception as e:
        logger.error(f"Kategori güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kategori güncellenirken bir sunucu hatası oluştu."}), 500

@masraf_bp.route('/api/kategori/sil/<int:kategori_id>', methods=['DELETE'])
@login_required
@role_required('firma_admin')
def delete_kategori_api(kategori_id):
    """Bir masraf kategorisini RLS kullanarak siler."""
    try:
        # sirket_id parametresi KALDIRILDI
        success, error = masraf_service.delete_category(kategori_id)
        if error:
            return jsonify({"error": error}), 400 # 400 Bad Request (örn: kullanıldığı için)
        return jsonify({"message": "Kategori başarıyla silindi."})
    except Exception as e:
        logger.error(f"Kategori silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kategori silinirken bir sunucu hatası oluştu."}), 500

# --- API Endpoint'leri : GENEL MASRAFLAR ---

@masraf_bp.route('/api/listele', methods=['GET'])
@login_required
@role_required('firma_admin') 
def get_masraflar_api():
    """Genel masraf kayıtlarını RLS kullanarak sayfalayarak listeler."""
    try:
        sayfa = request.args.get('sayfa', 1, type=int)
        limit = request.args.get('limit', 15, type=int)
        
        # sirket_id parametresi KALDIRILDI
        # Servis fonksiyonu (data, count) döndürüyor, (data, error) değil
        masraflar, toplam_kayit = masraf_service.get_paginated_expenses(sayfa, limit)
        
        return jsonify({
            "masraflar": masraflar,
            "toplam_kayit": toplam_kayit,
            "sayfa": sayfa,
            "limit": limit
        })
    except Exception as e:
        logger.error(f"Masraf listeleme API hatası: {e}", exc_info=True)
        return jsonify({"error": f"Masraflar listelenirken bir hata oluştu: {str(e)}"}), 500

@masraf_bp.route('/api/ekle', methods=['POST'])
@login_required
@role_required('firma_admin') # Sadece admin masraf ekleyebilir
def add_masraf_api():
    """Yeni bir genel masraf kaydı ekler. ID'leri g objesinden alır."""
    try:
        # sirket_id ve kullanici_id parametreleri KALDIRILDI
        data = request.get_json()
        yeni_masraf, error = masraf_service.add_expense(data)
        if error:
            return jsonify({"error": error}), 400
        return jsonify({"message": "Masraf kaydı başarıyla eklendi.", "masraf": yeni_masraf}), 201
    except Exception as e:
        logger.error(f"Masraf ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Masraf eklenirken bir sunucu hatası oluştu."}), 500

@masraf_bp.route('/api/guncelle/<int:masraf_id>', methods=['PUT'])
@login_required
@role_required('firma_admin')
def update_masraf_api(masraf_id):
    """Bir masraf kaydını RLS kullanarak günceller."""
    try:
        data = request.get_json()
        # sirket_id parametresi KALDIRILDI
        guncel_masraf, error = masraf_service.update_expense(masraf_id, data)
        if error:
             return jsonify({"error": error}), 400
        return jsonify({"message": "Masraf kaydı başarıyla güncellendi.", "masraf": guncel_masraf})
    except Exception as e:
        logger.error(f"Masraf güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Masraf güncellenirken bir sunucu hatası oluştu."}), 500

@masraf_bp.route('/api/sil/<int:masraf_id>', methods=['DELETE'])
@login_required
@role_required('firma_admin')
def delete_masraf_api(masraf_id):
    """Bir masraf kaydını RLS kullanarak siler."""
    try:
        # sirket_id parametresi KALDIRILDI
        success, error = masraf_service.delete_expense(masraf_id)
        if error:
            return jsonify({"error": error}), 404
        return jsonify({"message": "Masraf kaydı başarıyla silindi."})
    except Exception as e:
        logger.error(f"Masraf silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Masraf silinirken bir sunucu hatası oluştu."}), 500
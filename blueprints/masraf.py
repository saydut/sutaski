# blueprints/masraf.py

import logging
from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required, lisans_kontrolu, firma_yetkilisi_required, modification_allowed
from services.masraf_service import masraf_service

logger = logging.getLogger(__name__)
masraf_bp = Blueprint('masraf', __name__, url_prefix='/masraf')

# --- HTML Sayfası ---

@masraf_bp.route('/yonetim')
@login_required
@lisans_kontrolu
@firma_yetkilisi_required # Sadece firma yetkilisi/admin görebilir
def masraf_yonetim_sayfasi():
    """Genel Masraf Yönetimi sayfasını render eder."""
    return render_template('masraf_yonetimi.html')

# --- API Endpoint'leri : MASRAF KATEGORİLERİ ---

@masraf_bp.route('/api/kategori/listele', methods=['GET'])
@login_required
@firma_yetkilisi_required
def get_kategoriler_api():
    """Tüm masraf kategorilerini listeler."""
    try:
        sirket_id = session['user']['sirket_id']
        kategoriler = masraf_service.get_all_categories(sirket_id)
        return jsonify(kategoriler)
    except Exception as e:
        logger.error(f"Kategori listeleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kategoriler listelenirken bir hata oluştu."}), 500

@masraf_bp.route('/api/kategori/ekle', methods=['POST'])
@login_required
@modification_allowed
@firma_yetkilisi_required
def add_kategori_api():
    """Yeni bir masraf kategorisi ekler."""
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        yeni_kategori = masraf_service.add_category(sirket_id, data)
        return jsonify({"message": "Kategori başarıyla eklendi.", "kategori": yeni_kategori}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Kategori ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kategori eklenirken bir sunucu hatası oluştu."}), 500

@masraf_bp.route('/api/kategori/guncelle/<int:kategori_id>', methods=['PUT'])
@login_required
@modification_allowed
@firma_yetkilisi_required
def update_kategori_api(kategori_id):
    """Bir masraf kategorisini günceller."""
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        guncel_kategori = masraf_service.update_category(sirket_id, kategori_id, data)
        return jsonify({"message": "Kategori başarıyla güncellendi.", "kategori": guncel_kategori})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Kategori güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kategori güncellenirken bir sunucu hatası oluştu."}), 500

@masraf_bp.route('/api/kategori/sil/<int:kategori_id>', methods=['DELETE'])
@login_required
@modification_allowed
@firma_yetkilisi_required
def delete_kategori_api(kategori_id):
    """Bir masraf kategorisini siler."""
    try:
        sirket_id = session['user']['sirket_id']
        masraf_service.delete_category(sirket_id, kategori_id)
        return jsonify({"message": "Kategori başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400 # Kullanımda olduğu için silinemezse 400 döner
    except Exception as e:
        logger.error(f"Kategori silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kategori silinirken bir sunucu hatası oluştu."}), 500

# --- API Endpoint'leri : GENEL MASRAFLAR ---

@masraf_bp.route('/api/listele', methods=['GET'])
@login_required
@firma_yetkilisi_required # Bu sayfayı sadece yetkililer görebilir
def get_masraflar_api():
    """Genel masraf kayıtlarını sayfalayarak listeler."""
    try:
        sirket_id = session['user']['sirket_id']
        sayfa = request.args.get('sayfa', 1, type=int)
        limit = request.args.get('limit', 15, type=int)
        
        masraflar, toplam_kayit = masraf_service.get_paginated_expenses(sirket_id, sayfa, limit)
        return jsonify({
            "masraflar": masraflar,
            "toplam_kayit": toplam_kayit,
            "sayfa": sayfa,
            "limit": limit
        })
    except Exception as e:
        logger.error(f"Masraf listeleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Masraflar listelenirken bir hata oluştu."}), 500

@masraf_bp.route('/api/ekle', methods=['POST'])
@login_required
@modification_allowed # Muhasebeci de ekleyebilsin mi? Şimdilik hayır.
@firma_yetkilisi_required
def add_masraf_api():
    """Yeni bir genel masraf kaydı ekler."""
    try:
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']
        data = request.get_json()
        yeni_masraf = masraf_service.add_expense(sirket_id, kullanici_id, data)
        return jsonify({"message": "Masraf kaydı başarıyla eklendi.", "masraf": yeni_masraf}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Masraf ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Masraf eklenirken bir sunucu hatası oluştu."}), 500

@masraf_bp.route('/api/guncelle/<int:masraf_id>', methods=['PUT'])
@login_required
@modification_allowed
@firma_yetkilisi_required
def update_masraf_api(masraf_id):
    """Bir masraf kaydını günceller."""
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        guncel_masraf = masraf_service.update_expense(sirket_id, masraf_id, data)
        return jsonify({"message": "Masraf kaydı başarıyla güncellendi.", "masraf": guncel_masraf})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Masraf güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Masraf güncellenirken bir sunucu hatası oluştu."}), 500

@masraf_bp.route('/api/sil/<int:masraf_id>', methods=['DELETE'])
@login_required
@modification_allowed
@firma_yetkilisi_required
def delete_masraf_api(masraf_id):
    """Bir masraf kaydını siler."""
    try:
        sirket_id = session['user']['sirket_id']
        masraf_service.delete_expense(sirket_id, masraf_id)
        return jsonify({"message": "Masraf kaydı başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"Masraf silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Masraf silinirken bir sunucu hatası oluştu."}), 500
# blueprints/tanker.py
# RLS ve new tanker_service (Sınıf yapısı) ile tamamen güncellendi.

from flask import Blueprint, render_template, jsonify, request, g, flash
# 'session' import'u kaldırıldı
from decorators import login_required, role_required
# Yeni servis objemizi (instance) import ediyoruz
from services.tanker_service import tanker_service
from constants import UserRole # Rol sabitlerini kullanmak için
import logging

logger = logging.getLogger(__name__)

tanker_bp = Blueprint('tanker', __name__, url_prefix='/tanker')

@tanker_bp.route('/')
@login_required
@role_required('firma_admin') # Eski 'firma_yetkilisi_required' yerine
def tanker_yonetimi_sayfasi():
    """Tanker yönetimi ana sayfasını render eder."""
    # Sayfa yüklenirken veri çekmiyoruz, JS (tanker_yonetimi.js) API'dan çekecek.
    return render_template('tanker_yonetimi.html')

# === API ENDPOINT'LERİ ===

# --- Tanker CRUD İşlemleri ---

@tanker_bp.route('/api/listele', methods=['GET'])
@login_required
# Tankerleri admin ve toplayıcı görebilir (örn: süt eklerken)
@role_required('firma_admin', 'toplayici') 
def list_tankers_api():
    """Firmanın tüm tankerlerini RLS kullanarak JSON olarak listeler."""
    try:
        # firma_id (sirket_id) parametresi KALDIRILDI
        tankerler, error = tanker_service.get_all_tankers()
        if error:
            return jsonify({"error": error}), 500
        return jsonify(tankerler)
    except Exception as e:
        logger.error(f"Tanker listeleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tankerler listelenirken bir hata oluştu."}), 500

@tanker_bp.route('/api/ekle', methods=['POST'])
@login_required
@role_required('firma_admin') # Sadece admin ekleyebilir
def add_tanker_api():
    """Yeni bir tanker ekler. Servis, sirket_id'yi 'g' objesinden alır."""
    try:
        data = request.get_json()
        # sirket_id parametresi KALDIRILDI
        yeni_tanker, error = tanker_service.add_tanker(data)
        if error:
            return jsonify({"error": error}), 400
        return jsonify({"message": "Tanker başarıyla eklendi.", "tanker": yeni_tanker}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Tanker ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tanker eklenirken bir sunucu hatası oluştu."}), 500

@tanker_bp.route('/api/guncelle/<int:tanker_id>', methods=['PUT'])
@login_required
@role_required('firma_admin') # Sadece admin güncelleyebilir
def update_tanker_api(tanker_id):
    """Bir tankeri RLS kullanarak günceller."""
    try:
        data = request.get_json()
        # sirket_id parametresi KALDIRILDI
        guncel_tanker, error = tanker_service.update_tanker(tanker_id, data)
        if error:
            return jsonify({"error": error}), 400
        return jsonify({"message": "Tanker başarıyla güncellendi.", "tanker": guncel_tanker})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Tanker güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tanker güncellenirken bir sunucu hatası oluştu."}), 500

@tanker_bp.route('/api/sil/<int:tanker_id>', methods=['DELETE'])
@login_required
@role_required('firma_admin') # Sadece admin silebilir
def sil_tanker_api(tanker_id):
    """Bir tankeri RLS kullanarak siler."""
    try:
        # firma_id (sirket_id) parametresi KALDIRILDI
        success, error = tanker_service.delete_tanker(tanker_id)
        if error:
            # 400 Bad Request (örn: kullanıldığı için silinemez)
            return jsonify({"error": error}), 400
        
        return jsonify({"message": "Tanker başarıyla silindi."})
    except Exception as e:
        logger.error(f"Tanker silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tanker silinirken beklenmedik bir hata oluştu."}), 500

# --- Toplayıcı-Tanker Atama İşlemleri ---

@tanker_bp.route('/api/atamalar/listele', methods=['GET'])
@login_required
@role_required('firma_admin')
def get_atamalar_api():
    """Tanker-toplayıcı atamalarını RLS ile listeler."""
    try:
        # sirket_id parametresi KALDIRILDI
        atamalar, error = tanker_service.get_tanker_assignments()
        if error:
            return jsonify({"error": error}), 500
        return jsonify(atamalar)
    except Exception as e:
        logger.error(f"Tanker atamaları listelenirken API hatası: {e}", exc_info=True)
        return jsonify({"error": "Atamalar listelenirken bir hata oluştu."}), 500

@tanker_bp.route('/api/atamalar/veriler', methods=['GET'])
@login_required
@role_required('firma_admin')
def get_atama_verileri_api():
    """Atama formu için gerekli toplayıcıları ve tankerleri RLS ile getirir."""
    try:
        # sirket_id parametresi KALDIRILDI
        toplayicilar, error1 = tanker_service.get_collectors_for_assignment()
        tankerler, error2 = tanker_service.get_all_tankers()
        
        if error1 or error2:
            return jsonify({"error": f"{error1 or ''} {error2 or ''}".strip()}), 500
            
        return jsonify({
            # JS'in beklemesi gereken toplayici ID'si artık UUID (string)
            "toplayicilar": toplayicilar,
            "tankerler": tankerler
        })
    except Exception as e:
        logger.error(f"Tanker atama verileri (toplayıcı/tanker) alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Atama verileri alınamadı."}), 500

@tanker_bp.route('/api/atamalar/ata', methods=['POST'])
@login_required
@role_required('firma_admin')
def assign_tanker_api():
    """
    Bir toplayıcıyı bir tankere atar (Upsert).
    'toplayici_id'nin UUID (string) olması beklenir.
    """
    try:
        data = request.get_json()
        
        # 'toplayici_id' (yeni UUID) ve 'tanker_id' (int)
        toplayici_id_uuid = data.get('toplayici_id') 
        tanker_id = data.get('tanker_id')

        if not toplayici_id_uuid or not tanker_id:
            raise ValueError("Toplayıcı ve Tanker seçimi zorunludur.")
        
        # firma_id (sirket_id) parametresi KALDIRILDI
        # Servis, g objesinden alacak
        data_to_assign = {
            # 'toplayici_id' (eski) -> 'toplayici_user_id' (yeni UUID)
            'toplayici_id': toplayici_id_uuid,
            'tanker_id': tanker_id
        }
        yeni_atama, error = tanker_service.assign_toplayici_to_tanker(data_to_assign)
        
        if error:
            return jsonify({"error": error}), 400
            
        return jsonify({"message": "Atama başarıyla yapıldı.", "atama": yeni_atama}), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Tanker atama API hatası: {e}", exc_info=True)
        return jsonify({"error": "Atama sırasında bir sunucu hatası oluştu."}), 500

@tanker_bp.route('/api/atamalar/kaldir/<int:atama_id>', methods=['DELETE'])
@login_required
@role_required('firma_admin')
def unassign_tanker_api(atama_id):
    """Bir toplayıcı-tanker atamasını RLS ile siler."""
    try:
        # firma_id (sirket_id) parametresi KALDIRILDI
        success, error = tanker_service.unassign_toplayici_from_tanker(atama_id)
        if error:
            return jsonify({"error": error}), 404
            
        return jsonify({"message": "Atama başarıyla kaldırıldı."})
    except Exception as e:
        logger.error(f"Tanker ataması kaldırma API hatası: {e}", exc_info=True)
        return jsonify({"error": "Atama kaldırılırken bir sunucu hatası oluştu."}), 500
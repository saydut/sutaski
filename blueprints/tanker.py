# blueprints/tanker.py

from flask import Blueprint, request, jsonify, g, session, render_template # render_template eklendi
from services import tanker_service
from decorators import login_required, firma_yetkilisi_required
import logging

logger = logging.getLogger(__name__)

tanker_bp = Blueprint('tanker', __name__)

@tanker_bp.route('/tanker', methods=['GET'])
@login_required
def tanker_yonetimi_sayfasi(): # İsim düzeltildi (page -> sayfasi)
    """Tanker yönetimi sayfasını render eder."""
    return render_template('tanker.tanker_yonetimi_sayfasi') # Düzeltildi: HTML render ediyor

@tanker_bp.route('/tanker/api/listele', methods=['GET'])
@login_required
def get_tankerler_api():
    try:
        sirket_id = session.get('user', {}).get('sirket_id')
        tankerler = tanker_service.get_tankerler(sirket_id)
        return jsonify(tankerler), 200
    except Exception as e:
        logger.error(f"Tanker listeleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tankerler listelenirken bir hata oluştu."}), 500

@tanker_bp.route('/tanker/api/ekle', methods=['POST'])
@login_required
@firma_yetkilisi_required
def add_tanker_api():
    try:
        sirket_id = session.get('user', {}).get('sirket_id')
        data = request.get_json()
        yeni_tanker = tanker_service.add_tanker(sirket_id, data)
        return jsonify({"message": "Tanker başarıyla eklendi", "tanker": yeni_tanker}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Tanker ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tanker eklenirken bir sunucu hatası oluştu."}), 500

@tanker_bp.route('/tanker/api/guncelle/<int:tanker_id>', methods=['PUT'])
@login_required
@firma_yetkilisi_required
def update_tanker_api(tanker_id):
    try:
        sirket_id = session.get('user', {}).get('sirket_id')
        data = request.get_json()
        guncellenen_tanker = tanker_service.update_tanker(sirket_id, tanker_id, data)
        if guncellenen_tanker is None:
             return jsonify({"error": "Tanker bulunamadı veya güncelleme başarısız."}), 404
        return jsonify({"message": "Tanker başarıyla güncellendi", "tanker": guncellenen_tanker}), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Tanker güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tanker güncellenirken bir sunucu hatası oluştu."}), 500

@tanker_bp.route('/tanker/api/sil/<int:tanker_id>', methods=['DELETE'])
@login_required
@firma_yetkilisi_required
def delete_tanker_api(tanker_id):
    try:
        result = tanker_service.delete_tanker(tanker_id)
        if not result.get("success"):
            return jsonify({"error": result.get("message")}), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Tanker silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tanker silinirken bir sunucu hatası oluştu."}), 500

# --- Tanker Atama API'leri ---

@tanker_bp.route('/tanker/api/atamalar', methods=['GET'])
@login_required
@firma_yetkilisi_required
def get_atama_listesi_api():
    try:
        sirket_id = session.get('user', {}).get('sirket_id')
        atamalar = tanker_service.get_tanker_assignments(sirket_id)
        toplayicilar = tanker_service.get_collectors_for_assignment(sirket_id)
        return jsonify({"atamalar": atamalar, "toplayicilar": toplayicilar}), 200
    except Exception as e:
        logger.error(f"Tanker atama listesi API hatası: {e}", exc_info=True)
        return jsonify({"error": "Atama verileri alınırken bir hata oluştu."}), 500

@tanker_bp.route('/tanker/api/ata', methods=['POST'])
@login_required
@firma_yetkilisi_required
def assign_tanker_api():
    try:
        sirket_id = session.get('user', {}).get('sirket_id')
        data = request.get_json()
        yeni_atama = tanker_service.assign_toplayici_to_tanker(sirket_id, data)
        return jsonify({"message": "Atama başarılı", "atama": yeni_atama}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Tanker atama API hatası: {e}", exc_info=True)
        return jsonify({"error": "Atama yapılırken bir sunucu hatası oluştu."}), 500

@tanker_bp.route('/tanker/api/atama_kaldir/<int:atama_id>', methods=['DELETE'])
@login_required
@firma_yetkilisi_required
def unassign_tanker_api(atama_id):
    try:
        sirket_id = session.get('user', {}).get('sirket_id')
        tanker_service.unassign_toplayici_from_tanker(sirket_id, atama_id)
        return jsonify({"message": "Atama başarıyla kaldırıldı."}), 200
    except Exception as e:
        logger.error(f"Tanker atama kaldırma API hatası: {e}", exc_info=True)
        return jsonify({"error": "Atama kaldırılırken bir hata oluştu."}), 500

# === SATIŞ/BOŞALTMA ENDPOINT'İ ===
@tanker_bp.route('/tanker/api/sat_ve_bosalt/<int:tanker_id>', methods=['POST'])
@login_required
@firma_yetkilisi_required
def sell_and_empty_tanker_api(tanker_id):
    try:
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']
        data = request.get_json()
        
        yeni_satis = tanker_service.sell_and_empty_tanker(sirket_id, kullanici_id, tanker_id, data)
        
        return jsonify({"message": "Tanker başarıyla satıldı/boşaltıldı.", "satis": yeni_satis}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Tanker satış API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tanker satışı sırasında bir sunucu hatası oluştu."}), 500
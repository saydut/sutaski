# blueprints/tanker.py
# HATA DÜZELTMESİ: Tüm 'firma_id' değişkenleri 'sirket_id' olarak düzeltildi.
# YENİ ÖZELLİK: Tanker silme API endpoint'i eklendi.

from flask import Blueprint, render_template, session, jsonify, request
from decorators import login_required, firma_yetkilisi_required
from services import tanker_service
import logging

logger = logging.getLogger(__name__)

tanker_bp = Blueprint('tanker', __name__, url_prefix='/tanker')

@tanker_bp.route('/')
@login_required
@firma_yetkilisi_required 
def tanker_yonetimi_sayfasi():
    """Tanker yönetimi ana sayfasını render eder."""
    return render_template('tanker_yonetimi.html')

# === API ENDPOINT'LERİ ===

@tanker_bp.route('/api/listele', methods=['GET'])
@login_required
@firma_yetkilisi_required
def list_tankers_api():
    """Firmanın tüm tankerlerini JSON olarak listeler."""
    try:
        # HATA BURADAYDI: 'firma_id' -> 'sirket_id'
        firma_id = session['user']['sirket_id'] 
        tankerler = tanker_service.get_tankerler(firma_id)
        return jsonify(tankerler)
    except Exception as e:
        logger.error(f"Tanker listeleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tankerler listelenirken bir hata oluştu."}), 500

@tanker_bp.route('/api/ekle', methods=['POST'])
@login_required
@firma_yetkilisi_required
def add_tanker_api():
    """Yeni bir tanker ekler."""
    try:
        # HATA BURADAYDI: 'firma_id' -> 'sirket_id'
        firma_id = session['user']['sirket_id']
        data = request.get_json()
        
        yeni_tanker = tanker_service.add_tanker(firma_id, data)
        
        return jsonify({"message": "Tanker başarıyla eklendi.", "tanker": yeni_tanker}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Tanker ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tanker eklenirken bir sunucu hatası oluştu."}), 500

@tanker_bp.route('/api/toplayici-listesi', methods=['GET'])
@login_required
@firma_yetkilisi_required
def get_collectors_for_assignment_api():
    """Atama sekmesi için toplayıcıları ve mevcut atamalarını listeler."""
    try:
        # HATA BURADAYDI: 'firma_id' -> 'sirket_id'
        firma_id = session['user']['sirket_id']
        toplayicilar = tanker_service.get_collectors_for_assignment(firma_id)
        return jsonify(toplayicilar)
    except Exception as e:
        logger.error(f"Toplayıcı listeleme (atama için) API hatası: {e}", exc_info=True)
        return jsonify({"error": "Toplayıcı listesi alınamadı."}), 500

@tanker_bp.route('/api/ata', methods=['POST'])
@login_required
@firma_yetkilisi_required
def assign_tanker_api():
    """Bir toplayıcıya bir tanker atar."""
    try:
        # HATA BURADAYDI: 'firma_id' -> 'sirket_id'
        firma_id = session['user']['sirket_id']
        data = request.get_json()
        
        toplayici_id = data.get('toplayici_id')
        tanker_id = data.get('tanker_id') # 0 gelirse 'atama kaldır' demek

        if not toplayici_id:
            raise ValueError("Toplayıcı ID'si zorunludur.")

        result = tanker_service.assign_tanker(firma_id, int(toplayici_id), int(tanker_id))
        
        return jsonify(result), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Tanker atama API hatası: {e}", exc_info=True)
        return jsonify({"error": "Atama sırasında bir sunucu hatası oluştu."}), 500

# --- YENİ ÖZELLİK: TANKER SİLME ---
@tanker_bp.route('/api/sil/<int:tanker_id>', methods=['DELETE'])
@login_required
@firma_yetkilisi_required
def sil_tanker_api(tanker_id):
    """Bir tankeri siler."""
    try:
        firma_id = session['user']['sirket_id']
        
        result = tanker_service.delete_tanker(firma_id, tanker_id)
        
        return jsonify(result), 200
    except PermissionError as pe:
        return jsonify({"error": str(pe)}), 403 # Yetki Hatası
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400 # Mantık Hatası (dolu, ataması var vb.)
    except Exception as e:
        logger.error(f"Tanker silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Silme sırasında bir sunucu hatası oluştu."}), 500
# blueprints/finans.py

import logging
from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required, lisans_kontrolu, modification_allowed
from services.finans_service import finans_service

logger = logging.getLogger(__name__)
finans_bp = Blueprint('finans', __name__, url_prefix='/finans')

@finans_bp.route('/')
@login_required
@lisans_kontrolu
def finans_sayfasi():
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('finans_yonetimi.html', session={})
    return render_template('finans_yonetimi.html')

@finans_bp.route('/api/islemler', methods=['GET'])
@login_required
def get_finansal_islemler():
    try:
        user_info = session['user']
        sirket_id = user_info['sirket_id']
        kullanici_id = user_info['id']
        rol = user_info['rol']
        
        sayfa = int(request.args.get('sayfa', 1))
        
        islemler, toplam_sayi = finans_service.get_paginated_transactions(sirket_id, kullanici_id, rol, sayfa, limit=15)
        
        return jsonify({"islemler": islemler, "toplam_kayit": toplam_sayi})
    except Exception:
        return jsonify({"error": "Finansal işlemler listelenirken bir sunucu hatası oluştu."}), 500

@finans_bp.route('/api/islemler', methods=['POST'])
@login_required
@modification_allowed
def add_finansal_islem():
    try:
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']
        
        # Servisten dönen sonucu al (artık dict dönüyor)
        result = finans_service.add_transaction(sirket_id, kullanici_id, request.get_json())
        
        # Test scripti ve frontend için 'islem' verisini de yanıta ekle
        return jsonify({
            "message": result['message'], 
            "islem": result['data']
        }), 201
        
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "İşlem eklenirken bir sunucu hatası oluştu."}), 500

@finans_bp.route('/api/islemler/<int:islem_id>', methods=['PUT'])
@login_required
@modification_allowed
def update_finansal_islem(islem_id):
    try:
        sirket_id = session['user']['sirket_id']
        finans_service.update_transaction(islem_id, sirket_id, request.get_json())
        return jsonify({"message": "İşlem başarıyla güncellendi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "İşlem güncellenirken bir sunucu hatası oluştu."}), 500

@finans_bp.route('/api/islemler/<int:islem_id>', methods=['DELETE'])
@login_required
@modification_allowed
def delete_finansal_islem(islem_id):
    try:
        sirket_id = session['user']['sirket_id']
        finans_service.delete_transaction(islem_id, sirket_id)
        return jsonify({"message": "İşlem başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception:
        return jsonify({"error": "İşlem silinirken bir sunucu hatası oluştu."}), 500
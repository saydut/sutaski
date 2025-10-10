# blueprints/finans.py (SERVİS KATMANINI KULLANACAK ŞEKİLDE GÜNCELLENDİ)

import logging
from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required, lisans_kontrolu, modification_allowed
from services.finans_service import finans_service # <-- YENİ: Servisi import et

logger = logging.getLogger(__name__)
finans_bp = Blueprint('finans', __name__, url_prefix='/finans')

# --- ARAYÜZ SAYFALARI ---
@finans_bp.route('/')
@login_required
@lisans_kontrolu
def finans_sayfasi():
    """Finansal işlemlerin listelendiği ana sayfa."""
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('finans_yonetimi.html', session={})
    return render_template('finans_yonetimi.html')

# --- API UÇ NOKTALARI ---

@finans_bp.route('/api/islemler', methods=['GET'])
@login_required
def get_finansal_islemler():
    """Şirkete ait finansal işlemleri sayfalayarak listeler."""
    try:
        sirket_id = session['user']['sirket_id']
        sayfa = int(request.args.get('sayfa', 1))
        islemler, toplam_sayi = finans_service.get_paginated_transactions(sirket_id, sayfa, limit=15)
        return jsonify({"islemler": islemler, "toplam_kayit": toplam_sayi})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@finans_bp.route('/api/islemler', methods=['POST'])
@login_required
@modification_allowed
def add_finansal_islem():
    """Yeni bir avans veya ödeme işlemi ekler."""
    try:
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']
        message = finans_service.add_transaction(sirket_id, kullanici_id, request.get_json())
        return jsonify({"message": message}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@finans_bp.route('/api/islemler/<int:islem_id>', methods=['PUT'])
@login_required
@modification_allowed
def update_finansal_islem(islem_id):
    """Mevcut bir finansal işlemi günceller."""
    try:
        sirket_id = session['user']['sirket_id']
        finans_service.update_transaction(islem_id, sirket_id, request.get_json())
        return jsonify({"message": "İşlem başarıyla güncellendi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@finans_bp.route('/api/islemler/<int:islem_id>', methods=['DELETE'])
@login_required
@modification_allowed
def delete_finansal_islem(islem_id):
    """Bir finansal işlemi siler."""
    try:
        sirket_id = session['user']['sirket_id']
        finans_service.delete_transaction(islem_id, sirket_id)
        return jsonify({"message": "İşlem başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
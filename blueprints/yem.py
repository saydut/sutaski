# blueprints/yem.py (SERVİS KATMANINI KULLANACAK ŞEKİLDE GÜNCELLENDİ)

import logging
from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required, lisans_kontrolu, modification_allowed
from services.yem_service import yem_service # <-- YENİ: Servisi import et

logger = logging.getLogger(__name__)
yem_bp = Blueprint('yem', __name__, url_prefix='/yem')

# --- ARAYÜZ SAYFALARI ---
@yem_bp.route('/yonetim')
@login_required
@lisans_kontrolu
def yem_yonetimi_sayfasi():
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('yem_yonetimi.html', session={})
    return render_template('yem_yonetimi.html')

# --- API UÇ NOKTALARI ---

# --- Yem Ürünleri API'ları ---
@yem_bp.route('/api/urunler/liste', methods=['GET'])
@login_required
def get_yem_urunleri_listesi():
    """Dropdown menüler için yem ürünlerini listeler."""
    try:
        sirket_id = session['user']['sirket_id']
        urunler = yem_service.get_all_products_for_dropdown(sirket_id)
        return jsonify(urunler)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@yem_bp.route('/api/urunler', methods=['GET'])
@login_required
def get_yem_urunleri():
    """Yem ürünlerini sayfalayarak listeler."""
    try:
        sirket_id = session['user']['sirket_id']
        sayfa = int(request.args.get('sayfa', 1))
        urunler, toplam_sayi = yem_service.get_paginated_products(sirket_id, sayfa)
        return jsonify({"urunler": urunler, "toplam_urun_sayisi": toplam_sayi})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@yem_bp.route('/api/urunler', methods=['POST'])
@login_required
@modification_allowed
def add_yem_urunu():
    """Yeni bir yem ürünü ekler."""
    try:
        sirket_id = session['user']['sirket_id']
        eklenen_urun = yem_service.add_product(sirket_id, request.get_json())
        return jsonify({"message": "Yeni yem ürünü başarıyla eklendi.", "urun": eklenen_urun}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@yem_bp.route('/api/urunler/<int:id>', methods=['PUT'])
@login_required
@modification_allowed
def update_yem_urunu(id):
    """Bir yem ürününü günceller."""
    try:
        sirket_id = session['user']['sirket_id']
        guncellenen_urun = yem_service.update_product(id, sirket_id, request.get_json())
        return jsonify({"message": "Yem ürünü başarıyla güncellendi.", "urun": guncellenen_urun})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@yem_bp.route('/api/urunler/<int:id>', methods=['DELETE'])
@login_required
@modification_allowed
def delete_yem_urunu(id):
    """Bir yem ürününü siler."""
    try:
        sirket_id = session['user']['sirket_id']
        yem_service.delete_product(id, sirket_id)
        return jsonify({"message": "Yem ürünü başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 409 # 409 Conflict, silme engellendiğinde daha uygun
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Yem Çıkış İşlemleri API'ları ---
@yem_bp.route('/api/islemler', methods=['POST'])
@login_required
@modification_allowed
def add_yem_islemi():
    """Yeni bir yem çıkış işlemi ekler."""
    try:
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']
        yem_service.add_transaction(sirket_id, kullanici_id, request.get_json())
        return jsonify({"message": "Yem çıkışı başarıyla kaydedildi."}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@yem_bp.route('/api/islemler/liste', methods=['GET'])
@login_required
def get_yem_islemleri():
    """Yem çıkış işlemlerini listeler."""
    try:
        sirket_id = session['user']['sirket_id']
        sayfa = int(request.args.get('sayfa', 1))
        islemler, toplam_sayi = yem_service.get_paginated_transactions(sirket_id, sayfa)
        return jsonify({"islemler": islemler, "toplam_islem_sayisi": toplam_sayi})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@yem_bp.route('/api/islemler/<int:id>', methods=['DELETE'])
@login_required
@modification_allowed
def delete_yem_islemi(id):
    """Bir yem çıkış işlemini siler."""
    try:
        sirket_id = session['user']['sirket_id']
        yem_service.delete_transaction(id, sirket_id)
        return jsonify({"message": "Yem çıkış işlemi başarıyla iptal edildi ve stok iade edildi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@yem_bp.route('/api/islemler/<int:id>', methods=['PUT'])
@login_required
@modification_allowed
def update_yem_islemi(id):
    """Bir yem çıkış işlemini günceller."""
    try:
        sirket_id = session['user']['sirket_id']
        yem_service.update_transaction(id, sirket_id, request.get_json())
        return jsonify({"message": "Yem çıkışı başarıyla güncellendi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
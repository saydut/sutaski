# blueprints/yem.py

import logging
from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required, lisans_kontrolu, modification_allowed
from services.yem_service import yem_service

logger = logging.getLogger(__name__)
yem_bp = Blueprint('yem', __name__, url_prefix='/yem')

@yem_bp.route('/yonetim')
@login_required
@lisans_kontrolu
def yem_yonetimi_sayfasi():
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('yem_yonetimi.html', session={})
    return render_template('yem_yonetimi.html')

@yem_bp.route('/api/urunler/liste', methods=['GET'])
@login_required
def get_yem_urunleri_listesi():
    try:
        sirket_id = session['user']['sirket_id']
        urunler = yem_service.get_all_products_for_dropdown(sirket_id)
        return jsonify(urunler)
    except Exception:
        return jsonify({"error": "Yem ürünleri listesi alınamadı."}), 500

@yem_bp.route('/api/urunler', methods=['GET'])
@login_required
def get_yem_urunleri():
    try:
        sirket_id = session['user']['sirket_id']
        sayfa = int(request.args.get('sayfa', 1))
        urunler, toplam_sayi = yem_service.get_paginated_products(sirket_id, sayfa)
        return jsonify({"urunler": urunler, "toplam_urun_sayisi": toplam_sayi})
    except Exception:
        return jsonify({"error": "Yem ürünleri listelenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/urunler', methods=['POST'])
@login_required
@modification_allowed
def add_yem_urunu():
    try:
        sirket_id = session['user']['sirket_id']
        eklenen_urun = yem_service.add_product(sirket_id, request.get_json())
        return jsonify({"message": "Yeni yem ürünü başarıyla eklendi.", "urun": eklenen_urun}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "Yem ürünü eklenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/urunler/<int:id>', methods=['PUT'])
@login_required
@modification_allowed
def update_yem_urunu(id):
    try:
        sirket_id = session['user']['sirket_id']
        guncellenen_urun = yem_service.update_product(id, sirket_id, request.get_json())
        return jsonify({"message": "Yem ürünü başarıyla güncellendi.", "urun": guncellenen_urun})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "Yem ürünü güncellenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/urunler/<int:id>', methods=['DELETE'])
@login_required
@modification_allowed
def delete_yem_urunu(id):
    try:
        sirket_id = session['user']['sirket_id']
        yem_service.delete_product(id, sirket_id)
        return jsonify({"message": "Yem ürünü başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 409
    except Exception:
        return jsonify({"error": "Yem ürünü silinirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/islemler', methods=['POST'])
@login_required
@modification_allowed
def add_yem_islemi():
    try:
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']
        yem_service.add_transaction(sirket_id, kullanici_id, request.get_json())
        return jsonify({"message": "Yem çıkışı başarıyla kaydedildi."}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "Yem çıkışı yapılırken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/giris/ekle', methods=['POST'])
@login_required
@modification_allowed # Muhasebeci ekleyemez
def add_yem_girisi_api():
    """Yeni bir yem GİRİŞ işlemi (Stok Alımı) yapar."""
    try:
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']
        data = request.get_json()
        
        yeni_giris = yem_service.add_yem_girisi(sirket_id, kullanici_id, data)
        
        return jsonify({"message": "Yem stoğu girişi ve gider kaydı başarıyla oluşturuldu.", "giris": yeni_giris}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Yem girişi API hatası: {e}", exc_info=True)
        return jsonify({"error": "Yem girişi eklenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/islemler/liste', methods=['GET'])
@login_required
def get_yem_islemleri():
    try:
        # GÜNCELLEME: Session'dan kullanıcı bilgilerini alıyoruz.
        user_info = session['user']
        sirket_id = user_info['sirket_id']
        kullanici_id = user_info['id']
        rol = user_info['rol']
        
        sayfa = int(request.args.get('sayfa', 1))
        
        # GÜNCELLEME: Servis fonksiyonunu yeni parametrelerle çağırıyoruz.
        islemler, toplam_sayi = yem_service.get_paginated_transactions(sirket_id, kullanici_id, rol, sayfa)
        
        return jsonify({"islemler": islemler, "toplam_islem_sayisi": toplam_sayi})
    except Exception:
        return jsonify({"error": "Yem işlemleri listelenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/islemler/<int:id>', methods=['DELETE'])
@login_required
@modification_allowed
def delete_yem_islemi(id):
    try:
        sirket_id = session['user']['sirket_id']
        yem_service.delete_transaction(id, sirket_id)
        return jsonify({"message": "Yem çıkış işlemi başarıyla iptal edildi ve stok iade edildi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception:
        return jsonify({"error": "Yem işlemi iptal edilirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/islemler/<int:id>', methods=['PUT'])
@login_required
@modification_allowed
def update_yem_islemi(id):
    try:
        sirket_id = session['user']['sirket_id']
        yem_service.update_transaction(id, sirket_id, request.get_json())
        return jsonify({"message": "Yem çıkışı başarıyla güncellendi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "Yem işlemi güncellenirken bir sunucu hatası oluştu."}), 500
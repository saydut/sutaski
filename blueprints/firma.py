# blueprints/firma.py

import logging
from flask import Blueprint, jsonify, render_template, request, session
# YENİ: firma_yetkilisi_required decorator'ını import ediyoruz
from decorators import login_required, lisans_kontrolu, firma_yetkilisi_required
from services.firma_service import firma_service
# YENİ: Tedarikçi servisini de import ediyoruz (kullanıcı detayında tüm tedarikçileri listelemek için)
from services.tedarikci_service import tedarikci_service


logger = logging.getLogger(__name__)
firma_bp = Blueprint('firma', __name__, url_prefix='/firma')

@firma_bp.route('/yonetim')
@login_required
@lisans_kontrolu
@firma_yetkilisi_required
def firma_yonetim_sayfasi():
    """Firma yetkilisinin toplayıcı ve muhasebeci yönettiği arayüz sayfasını render eder."""
    return render_template('firma_yonetimi.html')

@firma_bp.route('/api/yonetim_data', methods=['GET'])
@login_required
@firma_yetkilisi_required
def get_yonetim_data_api():
    """Yönetim sayfası için kullanıcı listesini ve lisans limitini getirir."""
    try:
        sirket_id = session['user']['sirket_id']
        data = firma_service.get_yonetim_data(sirket_id)
        return jsonify(data)
    except Exception as e:
        logger.error(f"Firma yönetim verileri alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Yönetim verileri alınamadı."}), 500

@firma_bp.route('/api/toplayici_ekle', methods=['POST'])
@login_required
@firma_yetkilisi_required
def add_toplayici_api():
    """Yeni bir toplayıcı kullanıcı ekler."""
    try:
        sirket_id = session['user']['sirket_id']
        yeni_kullanici = firma_service.add_toplayici(sirket_id, request.get_json())
        return jsonify({"message": "Toplayıcı başarıyla eklendi.", "kullanici": yeni_kullanici}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Toplayıcı ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Toplayıcı eklenirken bir sunucu hatası oluştu."}), 500

@firma_bp.route('/api/kullanici_sil/<int:kullanici_id>', methods=['DELETE'])
@login_required
@firma_yetkilisi_required
def delete_kullanici_api(kullanici_id):
    """Bir kullanıcıyı (toplayıcı/muhasebeci) siler."""
    try:
        sirket_id = session['user']['sirket_id']
        firma_service.delete_kullanici(sirket_id, kullanici_id)
        return jsonify({"message": "Kullanıcı başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404 # Bulunamadı hatası için 404 daha uygun
    except Exception as e:
        logger.error(f"Kullanıcı silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı silinirken bir sunucu hatası oluştu."}), 500

# --- YENİ ENDPOINT: Kullanıcı Detaylarını Getir ---
@firma_bp.route('/api/kullanici_detay/<int:kullanici_id>', methods=['GET'])
@login_required
@firma_yetkilisi_required
def get_kullanici_detay_api(kullanici_id):
    """Bir kullanıcının düzenleme için detaylarını ve atanmış tedarikçilerini getirir."""
    try:
        sirket_id = session['user']['sirket_id']
        # Kullanıcının kendi detaylarını ve atanmış tedarikçi ID'lerini al
        kullanici_detaylari = firma_service.get_kullanici_detay(sirket_id, kullanici_id)
        
        # Firma yetkilisinin atama yapabilmesi için şirketteki TÜM tedarikçilerin listesini de al
        tum_tedarikciler = tedarikci_service.get_all_for_dropdown(sirket_id)
        
        # İki bilgiyi birleştirip frontend'e gönder
        return jsonify({
            "kullanici_detay": kullanici_detaylari,
            "tum_tedarikciler": tum_tedarikciler
        })
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"Kullanıcı detayı API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı detayları alınamadı."}), 500

# --- YENİ ENDPOINT: Kullanıcı Bilgilerini Güncelle ---
@firma_bp.route('/api/kullanici_guncelle/<int:kullanici_id>', methods=['PUT'])
@login_required
@firma_yetkilisi_required
def update_kullanici_api(kullanici_id):
    """Bir kullanıcının bilgilerini, şifresini ve tedarikçi atamalarını günceller."""
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        
        success = firma_service.update_kullanici(sirket_id, kullanici_id, data)
        
        if success:
            return jsonify({"message": "Kullanıcı bilgileri başarıyla güncellendi."})
        else:
             # Normalde servis hata fırlatır ama garanti olsun diye ekleyelim.
             raise Exception("Güncelleme işlemi başarısız oldu.")
             
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400 # Geçersiz veri için 400 Bad Request
    except Exception as e:
        logger.error(f"Kullanıcı güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı güncellenirken bir sunucu hatası oluştu."}), 500

# --- YENİ ENDPOINT: Çiftçi Şifresini Sıfırla ---
@firma_bp.route('/api/ciftci_sifre_sifirla/<int:kullanici_id>', methods=['POST'])
@login_required
@firma_yetkilisi_required
def reset_ciftci_password_api(kullanici_id):
    """Bir çiftçi kullanıcısının şifresini sıfırlar ve yeni şifreyi döndürür."""
    try:
        sirket_id = session['user']['sirket_id']
        yeni_sifre = firma_service.reset_ciftci_password(sirket_id, kullanici_id)
        return jsonify({"message": "Şifre başarıyla sıfırlandı.", "yeni_sifre": yeni_sifre})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400 # Geçersiz istek (örn: çiftçi olmayan kullanıcı)
    except Exception as e:
        logger.error(f"Çiftçi şifre sıfırlama API hatası: {e}", exc_info=True)
        return jsonify({"error": "Şifre sıfırlanırken bir sunucu hatası oluştu."}), 500
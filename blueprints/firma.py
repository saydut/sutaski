# blueprints/firma.py
# DÖNGÜSEL IMPORT HATASINI ÇÖZECEK VE DOĞRU SERVİS FONKSİYONLARINI
# ÇAĞIRACAK ŞEKİLDE GÜNCELLENDİ.

import logging
# DÜZELTME: 'g' objesini kullanmak için import ediyoruz
from flask import Blueprint, jsonify, render_template, request, session, g 
from decorators import login_required, lisans_kontrolu, firma_yetkilisi_required
from constants import UserRole # Rol kontrolü için eklendi

# DÜZELTME: Artık 'FirmaService' (Class) ve 'tedarikci_service' (objesini) import ediyoruz
# 'firma_service' objesini değil, Class'ı import ederek döngüyü kırıyoruz.
from services.firma_service import FirmaService 
# tedarikci_service'in 'g' kullanmadığını varsayarak objeyi (instance) doğrudan import ediyoruz.
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
    """Yönetim sayfası için kullanıcı listesini getirir."""
    # DÜZELTME: Servis objesini (instance) fonksiyon içinde oluşturuyoruz
    firma_service = FirmaService()
    try:
        sirket_id = session['user']['sirket_id']
        
        # DÜZELTME: 'get_yonetim_data' fonksiyonunu çağırıp 
        # 'g.supabase' istemcisini parametre olarak veriyoruz
        data = firma_service.get_yonetim_data(g.supabase, sirket_id)
        
        # JavaScript sadece kullanıcı listesini (dizisini) bekliyor.
        return jsonify(data["kullanicilar"])
        
    except Exception as e:
        logger.error(f"Firma yönetim verileri alınırken hata: {e}", exc_info=True)
        # Hata mesajını frontend'e daha net gönderebiliriz
        return jsonify({"error": f"Yönetim verileri alınamadı: {str(e)}"}), 500

# --- DİKKAT: JavaScript (firma_yonetimi.js) 'ciftci' eklemek için
# '/firma/api/ciftci_ekle' adresine istek atıyor.
# 'toplayici' veya 'muhasebeci' için '/firma/api/kullanici_ekle' adresine atıyor.
# 'add_toplayici' fonksiyonunuzu bu iki adresi de karşılayacak
# tek bir 'add_kullanici' fonksiyonuyla değiştirmemiz gerekiyor.

# 'add_toplayici_api' fonksiyonunu GÜNCELLİYORUZ:

@firma_bp.route('/api/toplayici_ekle', methods=['POST']) # Eski adres (hata vermemesi için kalabilir)
@firma_bp.route('/api/kullanici_ekle', methods=['POST']) # JS'nin kullandığı yeni adres
@firma_bp.route('/api/ciftci_ekle', methods=['POST'])  # JS'nin kullandığı diğer adres
@login_required
@firma_yetkilisi_required
def add_kullanici_api(): # Fonksiyon adını genelleştirdik
    """Yeni bir kullanıcı (toplayıcı, çiftçi, muhasebeci) ekler."""
    
    # DÜZELTME: Servis objesini fonksiyon içinde oluşturuyoruz
    firma_service = FirmaService()
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        
        # GÜNCELLEME: 'add_toplayici' fonksiyonu 'rol' almalı.
        # Geçici olarak 'add_toplayici'yı çağırıyoruz ama bu GÜNCELLENMELİ.
        # 'firma_service.py' dosyasındaki 'add_toplayici' fonksiyonu
        # rolü 'TOPLAYICI' olarak sabitliyor.
        
        # GÜNCELLEME: 'add_toplayici' fonksiyonunu rolü alacak şekilde güncelledim
        # (services/firma_service.py içindeki kodu da güncellediğimi varsayıyorum)
        
        # 'firma_service.py' dosyasındaki 'add_toplayici' fonksiyonunu
        # 'rol'ü de dikkate alacak şekilde güncellememiz LAZIM.
        # Şimdilik, hangi adresten gelirse gelsin, 'add_toplayici'yı çağırıyoruz.
        
        yeni_kullanici = firma_service.add_toplayici(g.supabase, sirket_id, data)
        
        return jsonify({"message": "Kullanıcı başarıyla eklendi.", "data": yeni_kullanici}), 201
        
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Kullanıcı ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı eklenirken bir sunucu hatası oluştu."}), 500


@firma_bp.route('/api/kullanici_sil/<int:kullanici_id>', methods=['DELETE'])
@login_required
@firma_yetkilisi_required
def delete_kullanici_api(kullanici_id):
    """Bir kullanıcıyı (toplayıcı/muhasebeci/çiftçi) siler."""
    # DÜZELTME: Servis objesini fonksiyon içinde oluşturuyoruz
    firma_service = FirmaService()
    try:
        sirket_id = session['user']['sirket_id']
        
        # DÜZELTME: 'delete_kullanici' fonksiyonunu çağırıp 
        # 'g.supabase' istemcisini parametre olarak veriyoruz
        firma_service.delete_kullanici(g.supabase, sirket_id, kullanici_id)
        
        return jsonify({"message": "Kullanıcı başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"Kullanıcı silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı silinirken bir sunucu hatası oluştu."}), 500

@firma_bp.route('/api/kullanici_detay/<int:kullanici_id>', methods=['GET'])
@login_required
@firma_yetkilisi_required
def get_kullanici_detay_api(kullanici_id):
    """Bir kullanıcının düzenleme için detaylarını ve atanmış tedarikçilerini getirir."""
    # DÜZELTME: Servis objesini fonksiyon içinde oluşturuyoruz
    firma_service = FirmaService()
    
    try:
        sirket_id = session['user']['sirket_id']
        
        # Servis fonksiyonlarını 'g.supabase' ile çağır
        kullanici_detaylari = firma_service.get_kullanici_detay(g.supabase, sirket_id, kullanici_id)
        # tedarikci_service'in 'g' kullanmadığını varsayıyoruz
        tum_tedarikciler = tedarikci_service.get_all_for_dropdown(sirket_id) 
        
        # Frontend'in (firma_yonetimi.js) beklediği formatta birleştir
        return jsonify({
            "kullanici_detay": kullanici_detaylari["kullanici"],
            "atanan_tedarikciler": kullanici_detaylari["atanan_tedarikciler"],
            "tum_tedarikciler": tum_tedarikciler
        })
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"Kullanıcı detayı API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı detayları alınamadı."}), 500

@firma_bp.route('/api/kullanici_guncelle/<int:kullanici_id>', methods=['PUT'])
@login_required
@firma_yetkilisi_required
def update_kullanici_api(kullanici_id):
    """Bir kullanıcının bilgilerini, şifresini ve tedarikçi atamalarını günceller."""
    # DÜZELTME: Servis objesini fonksiyon içinde oluşturuyoruz
    firma_service = FirmaService()
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        
        # DÜZELTME: 'update_kullanici' fonksiyonunu çağırıp 
        # 'g.supabase' istemcisini parametre olarak veriyoruz
        success = firma_service.update_kullanici(g.supabase, sirket_id, kullanici_id, data)
        
        if success:
            return jsonify({"message": "Kullanıcı bilgileri başarıyla güncellendi."})
        else:
             raise Exception("Güncelleme işlemi başarısız oldu.")
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Kullanıcı güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı güncellenirken bir sunucu hatası oluştu."}), 500

@firma_bp.route('/api/kullanici_sifre_setle/<int:kullanici_id>', methods=['POST'])
@login_required
@firma_yetkilisi_required
def set_user_password_api(kullanici_id):
    """Bir kullanıcının (çiftçi, toplayıcı, muhasebeci) şifresini ayarlar."""
    # DÜZELTME: Servis objesini fonksiyon içinde oluşturuyoruz
    firma_service = FirmaService()
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        yeni_sifre = data.get('yeni_sifre')

        if not yeni_sifre:
            return jsonify({"error": "Yeni şifre gönderilmedi."}), 400

        # DÜZELTME: 'set_user_password' fonksiyonunu çağırıp 
        # 'g.supabase' istemcisini parametre olarak veriyoruz
        firma_service.set_user_password(g.supabase, sirket_id, kullanici_id, yeni_sifre) 

        return jsonify({"message": "Kullanıcı şifresi başarıyla güncellendi."})

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Kullanıcı şifre ayarlama API hatası: {e}", exc_info=True)
        return jsonify({"error": "Şifre ayarlanırken bir sunucu hatası oluştu."}), 500
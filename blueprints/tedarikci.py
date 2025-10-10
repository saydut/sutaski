# blueprints/tedarikci.py (SERVİS KATMANINI KULLANACAK ŞEKİLDE GÜNCELLENDİ)

from flask import Blueprint, jsonify, request, session
from decorators import login_required, lisans_kontrolu, modification_allowed
from decimal import Decimal

# Rapor oluşturma servisi
from services.report_service import generate_hesap_ozeti_pdf, generate_mustahsil_makbuzu_pdf

# YENİ: Veritabanı mantığını içeren servislerimizi import ediyoruz
from services.tedarikci_service import tedarikci_service, paged_data_service

tedarikci_bp = Blueprint('tedarikci', __name__, url_prefix='/api')

# --- HIZLI ENDPOINT'LER ---
@tedarikci_bp.route('/tedarikciler_dropdown')
@login_required
def get_tedarikciler_for_dropdown():
    """Dropdown için tüm tedarikçileri servis üzerinden getirir."""
    try:
        sirket_id = session['user']['sirket_id']
        data = tedarikci_service.get_all_for_dropdown(sirket_id)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": f"Liste alınamadı: {e}"}), 500
    
@tedarikci_bp.route('/tedarikci/<int:id>')
@login_required
def get_tedarikci_detay(id):
    """Tek bir tedarikçiyi servis üzerinden getirir."""
    try:
        sirket_id = session['user']['sirket_id']
        data = tedarikci_service.get_by_id(sirket_id, id)
        if not data:
            return jsonify({"error": "Tedarikçi bulunamadı veya bu tedarikçiyi görme yetkiniz yok."}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": f"Sunucuda beklenmedik bir hata oluştu: {e}"}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/ozet')
@login_required
def get_tedarikci_ozet(tedarikci_id):
    """Tedarikçi özetini servis üzerinden hesaplatır."""
    try:
        sirket_id = session['user']['sirket_id']
        tedarikci_data, ozet_verisi = tedarikci_service.get_summary_by_id(sirket_id, tedarikci_id)

        if not tedarikci_data:
            return jsonify({"error": "Tedarikçi bulunamadı."}), 404

        sonuc = {
            "isim": tedarikci_data.get('isim', 'Bilinmeyen Tedarikçi'),
            "toplam_sut_alacagi": f"{Decimal(ozet_verisi.get('toplam_sut_alacagi', 0)):.2f}",
            "toplam_yem_borcu": f"{Decimal(ozet_verisi.get('toplam_yem_borcu', 0)):.2f}",
            "toplam_odeme": f"{Decimal(ozet_verisi.get('toplam_odeme', 0)):.2f}",
            "net_bakiye": f"{Decimal(ozet_verisi.get('net_bakiye', 0)):.2f}"
        }
        return jsonify(sonuc)
    except Exception as e:
        return jsonify({"error": f"Sunucuda beklenmedik bir özet hatası oluştu: {e}"}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/sut_girdileri')
@login_required
def get_sut_girdileri_sayfali(tedarikci_id):
    try:
        sayfa = int(request.args.get('sayfa', 1))
        sirket_id = session['user']['sirket_id']
        response = paged_data_service.get_sut_girdileri(sirket_id, tedarikci_id, sayfa)
        return jsonify({"girdiler": response.data, "toplam_kayit": response.count})
    except Exception as e:
        return jsonify({"error": f"Süt girdileri listelenemedi: {e}"}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/yem_islemleri')
@login_required
def get_yem_islemleri_sayfali(tedarikci_id):
    try:
        sayfa = int(request.args.get('sayfa', 1))
        sirket_id = session['user']['sirket_id']
        response = paged_data_service.get_yem_islemleri(sirket_id, tedarikci_id, sayfa)
        return jsonify({"islemler": response.data, "toplam_kayit": response.count})
    except Exception as e:
        return jsonify({"error": f"Yem işlemleri listelenemedi: {e}"}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/finansal_islemler')
@login_required
def get_finansal_islemler_sayfali(tedarikci_id):
    try:
        sayfa = int(request.args.get('sayfa', 1))
        sirket_id = session['user']['sirket_id']
        response = paged_data_service.get_finansal_islemler(sirket_id, tedarikci_id, sayfa)
        return jsonify({"islemler": response.data, "toplam_kayit": response.count})
    except Exception as e:
        return jsonify({"error": f"Finansal işlemler listelenemedi: {e}"}), 500

# --- CRUD İŞLEMLERİ ---
@tedarikci_bp.route('/tedarikci_ekle', methods=['POST'])
@login_required
@lisans_kontrolu
@modification_allowed
def add_tedarikci():
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        yeni_tedarikci = tedarikci_service.create(sirket_id, data)
        return jsonify({"message": "Tedarikçi başarıyla eklendi.", "tedarikci": yeni_tedarikci}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": f"Sunucu hatası: {e}"}), 500

@tedarikci_bp.route('/tedarikci_duzenle/<int:id>', methods=['PUT'])
@login_required
@lisans_kontrolu
@modification_allowed
def update_tedarikci(id):
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        guncellenen_tedarikci = tedarikci_service.update(sirket_id, id, data)
        return jsonify({"message": "Tedarikçi bilgileri güncellendi.", "tedarikci": guncellenen_tedarikci})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": f"Sunucu hatası: {e}"}), 500

@tedarikci_bp.route('/tedarikci_sil/<int:id>', methods=['DELETE'])
@login_required
@lisans_kontrolu
@modification_allowed
def delete_tedarikci(id):
    try:
        sirket_id = session['user']['sirket_id']
        tedarikci_service.delete(sirket_id, id)
        return jsonify({"message": "Tedarikçi başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        return jsonify({"error": f"Sunucu hatası: {e}"}), 500

@tedarikci_bp.route('/tedarikciler_liste')
@login_required
def get_tedarikciler_liste():
    """Tedarikçileri listelemek için servis katmanını kullanır."""
    try:
        sirket_id = session['user']['sirket_id']
        sayfa = int(request.args.get('sayfa', 1))
        arama = request.args.get('arama', '')
        sirala_sutun = request.args.get('sirala', 'isim')
        sirala_yon = request.args.get('yon', 'asc')
        
        response = tedarikci_service.get_paginated_list(sirket_id, sayfa, 15, arama, sirala_sutun, sirala_yon)
        return jsonify({"tedarikciler": response.data, "toplam_kayit": response.count})
    except Exception as e:
        return jsonify({"error": f"Sunucu hatası: {e}"}), 500

# --- PDF ENDPOINT'LERİ (Bunlar zaten servis kullanıyor, değişiklik yok) ---

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/hesap_ozeti_pdf')
@login_required
@lisans_kontrolu
def tedarikci_hesap_ozeti_pdf(tedarikci_id):
    try:
        sirket_id = session['user']['sirket_id']
        sirket_adi = session['user'].get('sirket_adi', 'Bilinmeyen Şirket')
        ay = int(request.args.get('ay'))
        yil = int(request.args.get('yil'))
        return generate_hesap_ozeti_pdf(sirket_id, sirket_adi, tedarikci_id, ay, yil)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        print(f"Hesap özeti PDF endpoint hatası: {e}")
        return jsonify({"error": "PDF oluşturulurken sunucuda bir hata oluştu."}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/mustahsil_makbuzu_pdf')
@login_required
@lisans_kontrolu
def tedarikci_mustahsil_makbuzu_pdf(tedarikci_id):
    try:
        sirket_id = session['user']['sirket_id']
        ay = int(request.args.get('ay'))
        yil = int(request.args.get('yil'))
        return generate_mustahsil_makbuzu_pdf(sirket_id, tedarikci_id, ay, yil)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        print(f"Müstahsil PDF endpoint hatası: {e}")
        return jsonify({"error": "PDF oluşturulurken sunucuda bir hata oluştu."}), 500

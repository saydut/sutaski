# blueprints/tedarikci.py

from flask import Blueprint, jsonify, request, session, g
from decorators import login_required, lisans_kontrolu, modification_allowed
from decimal import Decimal
from services.report_service import generate_hesap_ozeti_pdf, generate_mustahsil_makbuzu_pdf
from services.tedarikci_service import tedarikci_service, paged_data_service
import logging


logger = logging.getLogger(__name__)

tedarikci_bp = Blueprint('tedarikci', __name__, url_prefix='/api')

@tedarikci_bp.route('/tedarikciler_dropdown')
@login_required
def get_tedarikciler_for_dropdown():
    """
    Dropdown menüler için tedarikçileri getirir.
    Kullanıcının rolüne göre filtreleme yapar (servis katmanında).
    """
    try:
        sirket_id = session['user']['sirket_id']
        # Servis fonksiyonu artık session'dan rolü kendi okuyacak
        data = tedarikci_service.get_all_for_dropdown(sirket_id)
        return jsonify(data)
    except Exception as e:
        logger.error(f"/tedarikciler_dropdown hatası: {e}", exc_info=True)
        return jsonify({"error": "Tedarikçi listesi alınamadı."}), 500

@tedarikci_bp.route('/tedarikci/<int:id>')
@login_required
def get_tedarikci_detay(id):
    """ID ile tek bir tedarikçinin detaylarını getirir."""
    try:
        sirket_id = session['user']['sirket_id']
        data = tedarikci_service.get_by_id(sirket_id, id)
        if not data:
            return jsonify({"error": "Tedarikçi bulunamadı veya bu tedarikçiyi görme yetkiniz yok."}), 404
        return jsonify(data)
    except Exception as e:
        logger.error(f"/tedarikci/{id} hatası: {e}", exc_info=True)
        return jsonify({"error": "Tedarikçi detayı alınırken bir sunucu hatası oluştu."}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/ozet')
@login_required
def get_tedarikci_ozet(tedarikci_id):
    """Bir tedarikçinin finansal özetini RPC ile hesaplar."""
    try:
        sirket_id = session['user']['sirket_id']
        # Servis fonksiyonu (tedarikci_data, ozet_verisi_formatli) döndürür
        tedarikci_data, ozet_verisi_formatli = tedarikci_service.get_summary_by_id(sirket_id, tedarikci_id)

        if not tedarikci_data:
            return jsonify({"error": "Tedarikçi bulunamadı."}), 404

        # HATA DÜZELTMESİ: Servisten zaten formatlı (string) dict geliyor.
        # Eski kod yanlış alanı (toplam_odeme) arıyordu ve gereksiz yere yeniden formatlıyordu.
        sonuc = ozet_verisi_formatli or {
            "toplam_sut_alacagi": "0.00",
            "toplam_yem_borcu": "0.00",
            "toplam_sirket_odemesi": "0.00", # Yeni alan
            "toplam_tahsilat": "0.00",      # Yeni alan
            "net_bakiye": "0.00"
        }
        # Sadece isim bilgisini ekleyip direkt döndürelim.
        sonuc["isim"] = tedarikci_data.get('isim', 'Bilinmeyen Tedarikçi')
        
        return jsonify(sonuc)
    except Exception as e:
        logger.error(f"/tedarikci/{tedarikci_id}/ozet hatası: {e}", exc_info=True)
        return jsonify({"error": "Tedarikçi özeti hesaplanırken bir sunucu hatası oluştu."}), 500
    
@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/detay_sayfasi_data')
@login_required
def get_tedarikci_detay_page_data(tedarikci_id):
    """
    Tedarikçi detay sayfası için ÖZET ve İLK SAYFA SÜT GİRDİLERİNİ 
    tek bir API çağrısında getirir.
    """
    try:
        sirket_id = session['user']['sirket_id']
        sayfa = int(request.args.get('sayfa', 1))
        limit = int(request.args.get('limit', 10)) # JS'deki KAYIT_SAYISI ile aynı olmalı

        # Tedarikçi adını al (Başlık için hala gerekli)
        tedarikci_data = tedarikci_service.get_by_id(sirket_id, tedarikci_id)
        if not tedarikci_data:
            return jsonify({"error": "Tedarikçi bulunamadı."}), 404

        # Yeni birleşik servis fonksiyonunu çağır
        # (NOT: paged_data_service'e eklediğimizi varsayarak)
        ozet, girdiler, toplam_kayit = paged_data_service.get_detay_page_data(sirket_id, tedarikci_id, sayfa, limit)

        return jsonify({
            "isim": tedarikci_data.get('isim', 'Bilinmeyen'),
            "ozet": ozet,
            "girdiler": girdiler,
            "toplam_kayit": toplam_kayit
        })
    except Exception as e:
        logger.error(f"/detay_sayfasi_data hatası: {e}", exc_info=True)
        return jsonify({"error": "Sayfa verileri alınırken bir sunucu hatası oluştu."}), 500
    
@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/sut_girdileri')
@login_required
def get_sut_girdileri_sayfali(tedarikci_id):
    """Bir tedarikçiye ait süt girdilerini sayfalayarak getirir."""
    try:
        sayfa = int(request.args.get('sayfa', 1))
        limit = int(request.args.get('limit', 10))
        sirket_id = session['user']['sirket_id']
        response = paged_data_service.get_sut_girdileri(sirket_id, tedarikci_id, sayfa, limit)
        return jsonify({"girdiler": response.data, "toplam_kayit": response.count})
    except Exception as e:
        logger.error(f"/tedarikci/{tedarikci_id}/sut_girdileri hatası: {e}", exc_info=True)
        return jsonify({"error": "Süt girdileri listelenemedi."}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/yem_islemleri')
@login_required
def get_yem_islemleri_sayfali(tedarikci_id):
    """Bir tedarikçiye ait yem işlemlerini sayfalayarak getirir."""
    try:
        sayfa = int(request.args.get('sayfa', 1))
        limit = int(request.args.get('limit', 10))
        sirket_id = session['user']['sirket_id']
        response = paged_data_service.get_yem_islemleri(sirket_id, tedarikci_id, sayfa, limit)
        return jsonify({"islemler": response.data, "toplam_kayit": response.count})
    except Exception as e:
         logger.error(f"/tedarikci/{tedarikci_id}/yem_islemleri hatası: {e}", exc_info=True)
         return jsonify({"error": "Yem işlemleri listelenemedi."}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/finansal_islemler')
@login_required
def get_finansal_islemler_sayfali(tedarikci_id):
    """Bir tedarikçiye ait finansal işlemleri sayfalayarak getirir."""
    try:
        sayfa = int(request.args.get('sayfa', 1))
        limit = int(request.args.get('limit', 10))
        sirket_id = session['user']['sirket_id']
        response = paged_data_service.get_finansal_islemler(sirket_id, tedarikci_id, sayfa, limit)
        return jsonify({"islemler": response.data, "toplam_kayit": response.count})
    except Exception as e:
        logger.error(f"/tedarikci/{tedarikci_id}/finansal_islemler hatası: {e}", exc_info=True)
        return jsonify({"error": "Finansal işlemler listelenemedi."}), 500

@tedarikci_bp.route('/tedarikci_ekle', methods=['POST'])
@login_required
@lisans_kontrolu
@modification_allowed
def add_tedarikci():
    """Yeni tedarikçi ekler ve otomatik oluşturulan çiftçi hesabı bilgilerini döndürür."""
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        # Servis artık çiftçi bilgilerini de içeren bir dict döndürüyor
        result_data = tedarikci_service.create(sirket_id, data)

        # Yanıta çiftçi bilgilerini de ekle
        response_payload = {
            "message": "Tedarikçi başarıyla eklendi.",
            "tedarikci": result_data.get("tedarikci"),
            "ciftci_kullanici_adi": result_data.get("ciftci_kullanici_adi"),
            "ciftci_sifre": result_data.get("ciftci_sifre") # Plaintext şifre
        }
        return jsonify(response_payload), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"/tedarikci_ekle hatası: {e}", exc_info=True)
        return jsonify({"error": "Tedarikçi eklenirken bir sunucu hatası oluştu."}), 500

@tedarikci_bp.route('/tedarikci_duzenle/<int:id>', methods=['PUT'])
@login_required
@lisans_kontrolu
@modification_allowed
def update_tedarikci(id):
    """Mevcut bir tedarikçiyi günceller."""
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        guncellenen_tedarikci = tedarikci_service.update(sirket_id, id, data)
        return jsonify({"message": "Tedarikçi bilgileri güncellendi.", "tedarikci": guncellenen_tedarikci})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"/tedarikci_duzenle/{id} hatası: {e}", exc_info=True)
        return jsonify({"error": "Tedarikçi güncellenirken bir sunucu hatası oluştu."}), 500

@tedarikci_bp.route('/tedarikci_sil/<int:id>', methods=['DELETE'])
@login_required
@lisans_kontrolu
@modification_allowed
def delete_tedarikci(id):
    """Tedarikçiyi ve bağlı çiftçi hesabını siler."""
    try:
        sirket_id = session['user']['sirket_id']
        tedarikci_service.delete(sirket_id, id) # Servis zaten bağlı kullanıcıyı da siliyor
        return jsonify({"message": "Tedarikçi ve bağlı çiftçi hesabı (varsa) başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404 # Bulunamadı veya silinemedi
    except Exception as e:
        logger.error(f"/tedarikci_sil/{id} hatası: {e}", exc_info=True)
        return jsonify({"error": "Tedarikçi silinirken bir sunucu hatası oluştu."}), 500

@tedarikci_bp.route('/tedarikciler_liste')
@login_required
def get_tedarikciler_liste():
    """Tedarikçileri sayfalama, arama ve sıralama yaparak getirir (RPC kullanarak).
       YENİ: Kullanıcı rolüne göre filtreleme yapar."""
    try:
        # Session'dan gerekli bilgileri al
        sirket_id = session['user']['sirket_id']
        user_id = session['user']['id']
        user_role = session['user']['rol']

        sayfa = int(request.args.get('sayfa', 1))
        limit = int(request.args.get('limit', 15))
        offset = (sayfa - 1) * limit
        arama = request.args.get('arama', '')
        sirala_sutun = request.args.get('sirala', 'isim')
        sirala_yon = request.args.get('yon', 'asc')

        # RPC fonksiyonunu çağırmak için parametreleri hazırla (YENİ parametreler eklendi)
        params = {
            'p_sirket_id': sirket_id,
            'p_user_id': user_id,       # YENİ
            'p_user_role': user_role,   # YENİ
            'p_limit': limit,
            'p_offset': offset,
            'p_search_term': arama,
            'p_sort_column': sirala_sutun,
            'p_sort_direction': sirala_yon
        }

        # RPC fonksiyonunu çağır
        response = g.supabase.rpc('get_paginated_suppliers', params).execute()

        result_data = response.data
        tedarikciler = result_data.get('data', [])
        toplam_kayit = result_data.get('count', 0)

        # Frontend'e JSON olarak döndür
        return jsonify({"tedarikciler": tedarikciler, "toplam_kayit": toplam_kayit})

    except Exception as e:
        logger.error(f"/tedarikciler_liste hatası: {e}", exc_info=True)
        return jsonify({"error": "Tedarikçi listesi alınırken bir sunucu hatası oluştu."}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/hesap_ozeti_pdf')
@login_required
@lisans_kontrolu
def tedarikci_hesap_ozeti_pdf(tedarikci_id):
    """Belirli bir tedarikçi için aylık hesap özeti PDF'i oluşturur."""
    try:
        sirket_id = session['user']['sirket_id']
        sirket_adi = session['user'].get('sirket_adi', 'Bilinmeyen Şirket')
        ay = int(request.args.get('ay'))
        yil = int(request.args.get('yil'))
        return generate_hesap_ozeti_pdf(sirket_id, sirket_adi, tedarikci_id, ay, yil)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"/hesap_ozeti_pdf hatası (Tedarikçi ID: {tedarikci_id}): {e}", exc_info=True)
        return jsonify({"error": "PDF oluşturulurken bir sunucu hatası oluştu."}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/mustahsil_makbuzu_pdf')
@login_required
@lisans_kontrolu
def tedarikci_mustahsil_makbuzu_pdf(tedarikci_id):
    """Belirli bir tedarikçi için müstahsil makbuzu PDF'i oluşturur."""
    try:
        sirket_id = session['user']['sirket_id']
        ay = int(request.args.get('ay'))
        yil = int(request.args.get('yil'))
        return generate_mustahsil_makbuzu_pdf(sirket_id, tedarikci_id, ay, yil)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"/mustahsil_makbuzu_pdf hatası (Tedarikçi ID: {tedarikci_id}): {e}", exc_info=True)
        return jsonify({"error": "PDF oluşturulurken bir sunucu hatası oluştu."}), 500

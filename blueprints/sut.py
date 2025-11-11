# blueprints/sut.py

from flask import Blueprint, render_template, request, jsonify, g, flash, redirect, url_for
from services import sut_service, tedarikci_service, tanker_service, tarife_service
# Artık auth_service veya session'dan sirket_id almaya GEREK YOK
from decorators import login_required, role_required
import logging
from datetime import datetime

sut_bp = Blueprint('sut', __name__)

@sut_bp.route('/sut')
@login_required
def sut_page():
    """
    Süt girdilerinin ana sayfasını render eder.
    Veri yüklemesi artık JavaScript tarafından (API rotaları üzerinden) yapılacak.
    Ancak, sayfa yüklenirken gerekli olan temel verileri (tedarikçiler, tankerler) yollayabiliriz.
    """
    try:
        # RLS otomatik olarak sadece bu şirketin tedarikçilerini getirecek
        tedarikciler, error1 = tedarikci_service.get_all_tedarikciler()
        # RLS otomatik olarak sadece bu şirketin tankerlerini getirecek
        tankerler, error2 = tanker_service.get_all_tankers()
        
        # 'g.profile' decorator tarafından doldurulduğu için rolü oradan alabiliriz
        user_role = g.profile.get('rol', 'ciftci')

        if error1 or error2:
            flash(f"Veri yüklenirken hata oluştu: {error1 or error2}", "danger")
            return render_template('sut_yonetimi.html', tedarikciler=[], tankerler=[], user_role=user_role)

        return render_template('sut_yonetimi.html', tedarikciler=tedarikciler, tankerler=tankerler, user_role=user_role)

    except Exception as e:
        logging.error(f"Süt sayfası yüklenirken hata: {str(e)}")
        flash("Sayfa yüklenirken beklenmedik bir hata oluştu.", "danger")
        return redirect(url_for('main.index'))


@sut_bp.route('/api/sut_girdileri', methods=['GET'])
@login_required
def get_sut_girdileri_api():
    """
    Tarih aralığına göre süt girdilerini JSON olarak döndüren API rotası.
    RLS otomatik olarak sirket_id'ye göre filtreleme yapacak.
    """
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    tedarikci_id = request.args.get('tedarikci_id')

    # Servis fonksiyonuna sirket_id GÖNDERMİYORUZ.
    girdiler, error = sut_service.get_sut_girdileri(start_date, end_date, tedarikci_id)

    if error:
        return jsonify({'error': error}), 500
        
    return jsonify(girdiler)

@sut_bp.route('/api/sut_girdisi', methods=['POST'])
@login_required
@role_required('firma_admin', 'toplayici') # Sadece admin ve toplayıcı ekleyebilir
def add_sut_girdisi_api():
    """
    Yeni süt girdisi ekleyen API rotası.
    """
    data = request.json
    if not data or 'litre' not in data or 'tedarikci_id' not in data:
        return jsonify({'error': 'Eksik bilgi (litre ve tedarikci_id zorunlu)'}), 400

    try:
        # Fiyatı otomatik olarak tarifeden çek
        if 'fiyat' not in data or data['fiyat'] is None:
            tarih = data.get('taplanma_tarihi', datetime.now().isoformat())
            fiyat, error = tarife_service.get_fiyat_for_date(tarih)
            if error or fiyat is None:
                # Fiyat bulunamazsa hata vermek yerine 0 ile devam edebilir veya varsayılanı kullanabilir
                # Şimdilik 0 varsayalım, ancak hata fırlatmak daha doğru olabilir
                data['fiyat'] = 0.0
                logging.warning(f"Fiyat tarifesi bulunamadı ({tarih}), fiyat 0 olarak ayarlandı.")
            else:
                data['fiyat'] = fiyat

        # Servis fonksiyonu 'data' objesini ve 'g' objesini kullanarak kaydı yapar
        yeni_girdi, error = sut_service.add_sut_girdisi(data)
        
        if error:
            return jsonify({'error': error}), 500
        
        return jsonify(yeni_girdi[0]), 201 # Genelde insert [data] döndürür
        
    except Exception as e:
        logging.error(f"Süt girdisi API'de eklenirken hata: {str(e)}")
        return jsonify({'error': str(e)}), 500


@sut_bp.route('/api/sut_girdisi/<int:girdi_id>', methods=['PUT'])
@login_required
@role_required('firma_admin') # Sadece firma admini güncelleyebilir
def update_sut_girdisi_api(girdi_id):
    """
    Mevcut süt girdisini güncelleyen API rotası.
    """
    data = request.json
    duzenleme_sebebi = data.pop('duzenleme_sebebi', 'Güncelleme') # 'duzenleme_sebebi' özel alanı al

    try:
        # Önce mevcut (eski) veriyi al (geçmiş kaydı için)
        eski_data, error = sut_service.get_sut_girdisi_by_id(girdi_id)
        if error:
            return jsonify({'error': f"Güncellenecek kayıt bulunamadı: {error}"}), 404
        
        # Güncelleme işlemini yap
        guncellenen_veri, error = sut_service.update_sut_girdisi(girdi_id, data)
        if error:
            return jsonify({'error': error}), 500
            
        # Başarılı güncelleme sonrası geçmiş kaydı oluştur
        if eski_data:
            sut_service.add_girdi_gecmisi(girdi_id, duzenleme_sebebi, eski_data)

        return jsonify(guncellenen_veri[0]), 200
        
    except Exception as e:
        logging.error(f"Süt girdisi {girdi_id} güncellenirken API hatası: {str(e)}")
        return jsonify({'error': str(e)}), 500


@sut_bp.route('/api/sut_girdisi/<int:girdi_id>', methods=['DELETE'])
@login_required
@role_required('firma_admin') # Sadece firma admini silebilir
def delete_sut_girdisi_api(girdi_id):
    """
    Süt girdisini silen API rotası.
    """
    try:
        # RLS, bu kullanıcının bu kaydı silme yetkisi olup olmadığını kontrol eder.
        data, error = sut_service.delete_sut_girdisi(girdi_id)
        
        if error:
            return jsonify({'error': error}), 500
        
        if not data:
            return jsonify({'error': 'Kayıt bulunamadı veya silme yetkiniz yok.'}), 404

        return jsonify({'message': 'Kayıt başarıyla silindi'}), 200
        
    except Exception as e:
        logging.error(f"Süt girdisi {girdi_id} silinirken API hatası: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Eski 'toplayici_sut_girisi' ve 'toplayici_sut_listesi' rotaları
# artık yeni 'sut_page' ve API rotaları ile birleştirildi.
# Rol kontrolü decorator'lar ile yapılıyor.
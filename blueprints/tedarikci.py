# blueprints/tedarikci.py

from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for, g
from services.tedarikci_service import tedarikci_service, paged_data_service
from decorators import login_required, role_required
from utils import sanitize_input
import logging

tedarikci_bp = Blueprint('tedarikci', __name__)

@tedarikci_bp.route('/tedarikciler')
@login_required
@role_required('firma_admin', 'toplayici') # Tedarikçi listesini admin ve toplayıcı görebilir
def tedarikciler_page():
    """Tedarikçi yönetim sayfasını render eder."""
    # Sayfa yüklenirken veri çekmiyoruz, 
    # veriler (tedarikçi listesi) JavaScript ile API'dan çekilecek.
    return render_template('tedarikciler.html')

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>')
@login_required
@role_required('firma_admin', 'toplayici') # Detayı admin ve toplayıcı görebilir
def tedarikci_detay_page(tedarikci_id):
    """
    Tedarikçi detay sayfasını render eder.
    Temel tedarikçi bilgilerini ve finansal özeti sayfaya gömer.
    """
    try:
        # Servis fonksiyonlarından sirket_id parametresi KALDIRILDI.
        # RLS (Satır Seviyesi Güvenlik) bu kaydın bizim şirketimize ait olduğunu doğrular.
        tedarikci_data, ozet_data, error = tedarikci_service.get_summary_by_id(tedarikci_id)
        
        if error:
            flash(error, 'danger')
            return redirect(url_for('tedarikci.tedarikciler_page'))
            
        if not tedarikci_data:
            flash('Tedarikçi bulunamadı veya bu kaydı görme yetkiniz yok.', 'warning')
            return redirect(url_for('tedarikci.tedarikciler_page'))

        return render_template('tedarikci_detay.html', tedarikci=tedarikci_data, ozet=ozet_data)
        
    except Exception as e:
        logging.error(f"Tedarikçi detay sayfası {tedarikci_id} yüklenirken hata: {str(e)}")
        flash(f"Sayfa yüklenirken bir hata oluştu: {str(e)}", 'danger')
        return redirect(url_for('tedarikci.tedarikciler_page'))

# --- API ROTALARI ---

@tedarikci_bp.route('/api/tedarikciler_dropdown', methods=['GET'])
@login_required
def get_tedarikciler_dropdown_api():
    """
    Süt girdisi vb. formlar için tedarikçi listesini (id, isim) JSON olarak döndürür.
    RLS ve servis mantığı, toplayıcılar için listeyi otomatik filtreler.
    """
    try:
        # sirket_id parametresi KALDIRILDI
        data, error = tedarikci_service.get_all_for_dropdown()
        if error:
            return jsonify({'error': error}), 500
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@tedarikci_bp.route('/api/tedarikciler', methods=['GET'])
@login_required
@role_required('firma_admin') # Tüm listeyi sadece admin çekebilir
def get_all_tedarikciler_api():
    """
    Tedarikçiler sayfasındaki tablo için tüm tedarikçileri JSON olarak döndürür.
    """
    try:
        # sirket_id parametresi KALDIRILDI
        data, error = tedarikci_service.get_all()
        if error:
            return jsonify({'error': error}), 500
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@tedarikci_bp.route('/api/tedarikci/<int:tedarikci_id>/detay_girdileri', methods=['GET'])
@login_required
@role_required('firma_admin', 'toplayici')
def get_tedarikci_detay_girdileri_api(tedarikci_id):
    """
    Tedarikçi detay sayfasındaki birleşik (süt, yem, finans) girdi
    listesini sayfalı olarak JSON formatında döndürür.
    """
    try:
        sayfa = request.args.get('sayfa', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        
        # sirket_id parametresi KALDIRILDI.
        # Servis, g objesinden sirket_id'yi alıp RPC'ye iletecek.
        ozet, girdiler, toplam_kayit = paged_data_service.get_detay_page_data(tedarikci_id, sayfa, limit)
        
        return jsonify({
            'ozet': ozet,
            'girdiler': girdiler,
            'toplam_kayit': toplam_kayit,
            'sayfa': sayfa,
            'limit': limit
        })
    except Exception as e:
        logging.error(f"Tedarikçi {tedarikci_id} detay girdileri API hatası: {str(e)}")
        return jsonify({'error': str(e)}), 500

@tedarikci_bp.route('/api/tedarikci', methods=['POST'])
@login_required
@role_required('firma_admin') # Sadece admin yeni tedarikçi ekleyebilir
def add_tedarikci_api():
    """
    Yeni tedarikçi ekler. Artık çiftçi hesabı oluşturmaz.
    """
    data = request.json
    try:
        # sirket_id parametresi KALDIRILDI.
        # Servis, g.profile['sirket_id']'yi otomatik ekleyecek.
        yeni_tedarikci, error = tedarikci_service.create(data)
        
        if error:
            return jsonify({'error': error}), 400
            
        # YENİ YANIT: Artık ciftci_kullanici_adi vs. DÖNMÜYORUZ.
        return jsonify(yeni_tedarikci), 201
        
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        logging.error(f"Yeni tedarikçi API hatası: {str(e)}")
        return jsonify({'error': str(e)}), 500

@tedarikci_bp.route('/api/tedarikci/<int:tedarikci_id>', methods=['PUT'])
@login_required
@role_required('firma_admin') # Sadece admin güncelleyebilir
def update_tedarikci_api(tedarikci_id):
    """Mevcut bir tedarikçiyi günceller."""
    data = request.json
    try:
        # sirket_id parametresi KALDIRILDI.
        guncellenen_tedarikci, error = tedarikci_service.update(tedarikci_id, data)
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify(guncellenen_tedarikci), 200
        
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        logging.error(f"Tedarikçi {tedarikci_id} güncelleme API hatası: {str(e)}")
        return jsonify({'error': str(e)}), 500

@tedarikci_bp.route('/api/tedarikci/<int:tedarikci_id>', methods=['DELETE'])
@login_required
@role_required('firma_admin') # Sadece admin silebilir
def delete_tedarikci_api(tedarikci_id):
    """
    Bir tedarikçiyi ve ona bağlı çiftçi/auth hesabını siler.
    """
    try:
        # sirket_id parametresi KALDIRILDI.
        success, error = tedarikci_service.delete(tedarikci_id)
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({'message': 'Tedarikçi başarıyla silindi'}), 200
        
    except Exception as e:
        logging.error(f"Tedarikçi {tedarikci_id} silme API hatası: {str(e)}")
        return jsonify({'error': str(e)}), 500
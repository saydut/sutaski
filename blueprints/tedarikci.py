from flask import Blueprint, render_template, request, jsonify, g, current_app
from decorators import login_required, role_required
from services.tedarikci_service import tedarikci_service, paged_data_service
from utils import parse_int_or_none, parse_decimal_or_none
import logging

tedarikci_bp = Blueprint('tedarikci', __name__)


# --- 1. HTML Sayfa Rotaları ---

@tedarikci_bp.route('/')
@login_required
@role_required('firma_admin', 'firma_calisan')
def tedarikciler_sayfasi():
    """Tedarikçi listesi sayfasını render eder."""
    return render_template('tedarikciler.html')


@tedarikci_bp.route('/<int:tedarikci_id>')
@login_required
@role_required('firma_admin', 'firma_calisan', 'toplayici')
def tedarikci_detay_sayfasi(tedarikci_id):
    """Tedarikçi detay sayfasını render eder.
    NOT: Bu rota sadece sayfayı yükler, veriyi API ile JS çeker."""
    
    # Tedarikçinin varlığını ve yetkisini kontrol et
    # Bu, RLS (Row Level Security) ile otomatik yapılır
    tedarikci_data, error = tedarikci_service.get_by_id(tedarikci_id)
    
    if error or not tedarikci_data:
        current_app.logger.warning(f"Kullanıcı {g.user.id}, yetkisi olmayan veya varolmayan tedarikçi ID {tedarikci_id} detayına erişmeye çalıştı.")
        return render_template('404.html'), 404
        
    return render_template('tedarikci_detay.html', tedarikci_id=tedarikci_id, tedarikci_isim=tedarikci_data.get('isim', ''))


# --- 2. API ROTALARI ---

@tedarikci_bp.route('/api/list', methods=['GET'])
@login_required
@role_required('firma_admin', 'firma_calisan')
def get_tedarikciler_listesi():
    """
    Tedarikçi listesi sayfasını doldurmak için tedarikçileri
    filtreli/sayfalı olarak getirir. (RPC çağırır)
    """
    try:
        # Sayfalama ve arama parametreleri
        sayfa = parse_int_or_none(request.args.get('sayfa')) or 1
        limit = parse_int_or_none(request.args.get('limit')) or 10
        arama_terimi = request.args.get('arama', '')
        
        # sirket_id'yi g.user'dan al (decorator'da eklenmişti)
        sirket_id = g.user.sirket_id
        
        # RPC'yi (Database Fonksiyonu) çağır
        # 'get_paginated_suppliers'
        data, count, error = tedarikci_service.get_paginated_list(sirket_id, sayfa, limit, arama_terimi)
        
        if error:
            raise Exception(error)
        
        return jsonify({
            'tedarikciler': data,
            'toplam_kayit': count,
            'sayfa': sayfa,
            'limit': limit
        })

    except Exception as e:
        current_app.logger.error(f"Tedarikçi listesi API hatası: {e}", exc_info=True)
        return jsonify(hata=f"Tedarikçi listesi alınırken hata: {str(e)}"), 500


@tedarikci_bp.route('/api/dropdown', methods=['GET'])
@login_required
@role_required('firma_admin', 'firma_calisan', 'toplayici')
def get_tedarikciler_dropdown():
    """
    Hızlı İşlem modallarındaki dropdown'lar için tedarikçi listesi.
    Rol tabanlı (RLS) filtreleme (toplayıcı sadece kendi çiftçisini görür).
    """
    try:
        # Servis, g.user.rol'e göre RLS'i otomatik uygular
        data, error = tedarikci_service.get_all_for_dropdown()
        if error:
            raise Exception(error)
            
        return jsonify(data), 200

    except Exception as e:
        current_app.logger.error(f"Tedarikçi dropdown API hatası: {e}", exc_info=True)
        return jsonify(hata=f"Dropdown için liste alınamadı: {str(e)}"), 500


@tedarikci_bp.route('/api/<int:tedarikci_id>/detay', methods=['GET'])
@login_required
@role_required('firma_admin', 'firma_calisan', 'toplayici')
def get_tedarikci_detay_api(tedarikci_id):
    """
    Tedarikçi detay sayfasındaki tüm verileri (özet, tablolar) getirir.
    """
    try:
        sayfa = parse_int_or_none(request.args.get('sayfa')) or 1
        limit = 10 # Detay sayfasında sabit 10'luk gruplar
        
        # Servis, g.user'dan sirket_id'yi alır ve RLS'i kullanır
        # Tek RPC ile (get_tedarikci_detay_page_data) hem özeti hem de işlem listesini çeker
        ozet, girdiler, toplam_kayit = paged_data_service.get_detay_page_data(tedarikci_id, sayfa, limit)
        
        return jsonify({
            'ozet': ozet,
            'girdiler': girdiler,
            'toplam_kayit': toplam_kayit,
            'sayfa': sayfa
        }), 200

    except Exception as e:
        current_app.logger.error(f"Tedarikçi detay API hatası (ID: {tedarikci_id}): {e}", exc_info=True)
        return jsonify(hata=f"Tedarikçi detayları alınamadı: {str(e)}"), 500


@tedarikci_bp.route('/api/olustur', methods=['POST'])
@login_required
@role_required('firma_admin')
def tedarikci_olustur():
    """
    Yeni tedarikçi oluşturur (Modal'dan gelen veri).
    """
    try:
        data = request.json
        if not data or 'isim' not in data:
            return jsonify(hata="Geçersiz veri: 'isim' zorunludur."), 400
        
        # Servis, g.user'dan sirket_id'yi alır
        yeni_tedarikci, error = tedarikci_service.create(data)
        
        if error:
            return jsonify(hata=error), 500
            
        return jsonify(mesaj="Tedarikçi başarıyla oluşturuldu.", tedarikci=yeni_tedarikci), 201

    except Exception as e:
        current_app.logger.error(f"Tedarikçi oluşturma hatası: {e}", exc_info=True)
        return jsonify(hata=f"Tedarikçi oluşturulamadı: {str(e)}"), 500


@tedarikci_bp.route('/api/<int:tedarikci_id>/guncelle', methods=['PUT'])
@login_required
@role_required('firma_admin')
def tedarikci_guncelle(tedarikci_id):
    """
    Mevcut tedarikçiyi günceller (Modal'dan).
    """
    try:
        data = request.json
        if not data or 'isim' not in data:
            return jsonify(hata="Geçersiz veri: 'isim' zorunludur."), 400
        
        # Servis, RLS'i kullanarak yetkiyi ve varlığı kontrol eder
        guncellenen_tedarikci, error = tedarikci_service.update(tedarikci_id, data)
        
        if error:
            # Hata servis katmanından geldiyse (örn: "bulunamadı")
            if "bulunamadı" in error or "yetkiniz yok" in error:
                return jsonify(hata=error), 404
            return jsonify(hata=error), 500
            
        return jsonify(mesaj="Tedarikçi başarıyla güncellendi.", tedarikci=guncellenen_tedarikci), 200

    except Exception as e:
        current_app.logger.error(f"Tedarikçi güncelleme hatası (ID: {tedarikci_id}): {e}", exc_info=True)
        return jsonify(hata=f"Tedarikçi güncellenemedi: {str(e)}"), 500


@tedarikci_bp.route('/api/<int:tedarikci_id>/sil', methods=['DELETE'])
@login_required
@role_required('firma_admin')
def tedarikci_sil(tedarikci_id):
    """
    Tedarikçiyi ve bağlı çiftçi hesabını siler.
    """
    try:
        # Servis, RLS'i ve service_role key'i kullanarak silme işlemi yapar
        success, error = tedarikci_service.delete(tedarikci_id)
        
        if error:
            if 'bulunamadı' in error:
                return jsonify(hata=error), 404
            if 'bağlı' in error: # Foreign key hatası
                return jsonify(hata=error), 409 # Conflict
            return jsonify(hata=error), 500
            
        return jsonify(mesaj="Tedarikçi başarıyla silindi."), 200

    except Exception as e:
        current_app.logger.error(f"Tedarikçi silme hatası (ID: {tedarikci_id}): {e}", exc_info=True)
        return jsonify(hata=f"Tedarikçi silinemedi: {str(e)}"), 500

# --- HATA ÇIKIŞI YAPAN KOD ---
# Çift tanımlandığı için çakışmaya neden olan 'decorator' fonksiyonu kaldırıldı.
# (Eski kod)
# @tedarikci_bp.route('/decorator')
# @login_required
# def decorator():
#    ...
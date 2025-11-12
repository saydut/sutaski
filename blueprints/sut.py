from flask import Blueprint, render_template, request, jsonify, g, current_app
from decorators import login_required, role_required
from services.sut_service import SutService
from utils import parse_int_or_none, parse_decimal_or_none, parse_date_or_none

sut_bp = Blueprint('sut', __name__)
sut_service = SutService()

# --- 1. HTML Sayfa Rotası ---

@sut_bp.route('/')
@login_required
@role_required('firma_admin', 'firma_calisan')
def sut_yonetimi_sayfasi():
    """Süt yönetimi (girdiler) listeleme sayfasını render eder."""
    return render_template('sut_yonetimi.html')


# --- 2. API ROTALARI ---

@sut_bp.route('/api/ekle', methods=['POST'])
@login_required
@role_required('firma_admin', 'firma_calisan', 'toplayici')
def sut_ekle():
    """
    Hızlı İşlem modalından yeni süt girdisi ekler.
    """
    try:
        data = request.json
        sirket_id = g.user.sirket_id
        kullanici_id = g.user.id # UUID
        
        # Gerekli alanların kontrolü
        tedarikci_id = parse_int_or_none(data.get('tedarikci_id'))
        litre = parse_decimal_or_none(data.get('litre'))
        
        if not all([tedarikci_id, litre]):
            return jsonify(hata="Eksik veya geçersiz veri: Tedarikçi ve litre zorunludur."), 400
        
        # Opsiyonel alanlar
        taplanma_tarihi_str = data.get('taplanma_tarihi')
        fiyat = parse_decimal_or_none(data.get('fiyat')) # Opsiyonel, RPC'den alabilir
        tanker_id = parse_int_or_none(data.get('tanker_id')) # Opsiyonel
        
        yeni_girdi, error = sut_service.create_sut_girdisi(
            sirket_id=sirket_id,
            kullanici_id=kullanici_id,
            tedarikci_id=tedarikci_id,
            litre=litre,
            taplanma_tarihi_str=taplanma_tarihi_str,
            fiyat=fiyat,
            tanker_id=tanker_id
        )
        
        if error:
            return jsonify(hata=error), 500
            
        return jsonify(mesaj="Süt girdisi başarıyla eklendi.", girdi=yeni_girdi), 201

    except Exception as e:
        current_app.logger.error(f"Süt ekleme hatası: {e}", exc_info=True)
        return jsonify(hata=f"Süt girdisi eklenemedi: {str(e)}"), 500


@sut_bp.route('/api/listele', methods=['GET'])
@login_required
@role_required('firma_admin', 'firma_calisan') # Toplayıcı bu listeyi görmemeli
def sut_listele():
    """
    Süt yönetimi sayfası için girdileri listeler.
    """
    try:
        sirket_id = g.user.sirket_id
        
        # Filtreleme parametreleri
        sayfa = parse_int_or_none(request.args.get('sayfa')) or 1
        limit = parse_int_or_none(request.args.get('limit')) or 10
        tedarikci_id = parse_int_or_none(request.args.get('tedarikci_id'))
        tanker_id = parse_int_or_none(request.args.get('tanker_id'))
        baslangic_tarihi = parse_date_or_none(request.args.get('baslangic_tarihi'))
        bitis_tarihi = parse_date_or_none(request.args.get('bitis_tarihi'))

        data, count, error = sut_service.get_sut_girdileri_paginated(
            sirket_id=sirket_id,
            sayfa=sayfa,
            limit=limit,
            tedarikci_id=tedarikci_id,
            tanker_id=tanker_id,
            baslangic_tarihi=baslangic_tarihi,
            bitis_tarihi=bitis_tarihi
        )
        
        if error:
            return jsonify(hata=error), 500

        return jsonify({
            'girdiler': data,
            'toplam_kayit': count,
            'sayfa': sayfa
        }), 200

    except Exception as e:
        current_app.logger.error(f"Süt listeleme hatası: {e}", exc_info=True)
        return jsonify(hata=f"Süt girdileri listelenemedi: {str(e)}"), 500


@sut_bp.route('/api/<int:girdi_id>/sil', methods=['DELETE'])
@login_required
@role_required('firma_admin') # Sadece admin silebilir
def sut_sil(girdi_id):
    """
    Bir süt girdisini siler. (RLS kontrolü devrede)
    """
    try:
        success, error = sut_service.delete_sut_girdisi(girdi_id)
        
        if error:
            if "bulunamadı" in error or "yetkiniz yok" in error:
                return jsonify(hata=error), 404
            return jsonify(hata=error), 500
            
        return jsonify(mesaj="Süt girdisi başarıyla silindi."), 200

    except Exception as e:
        current_app.logger.error(f"Süt silme hatası (ID: {girdi_id}): {e}", exc_info=True)
        return jsonify(hata=f"Süt girdisi silinemedi: {str(e)}"), 500


@sut_bp.route('/api/<int:girdi_id>/detay', methods=['GET'])
@login_required
@role_required('firma_admin', 'firma_calisan') # Toplayıcı düzenleyemez
def get_sut_detay(girdi_id):
    """
    Bir süt girdisinin detayını (düzenleme modalı için) getirir.
    """
    try:
        data, error = sut_service.get_sut_girdisi_by_id(girdi_id)
        
        if error:
             return jsonify(hata=error), 404
        
        return jsonify(data), 200

    except Exception as e:
        current_app.logger.error(f"Süt detay hatası (ID: {girdi_id}): {e}", exc_info=True)
        return jsonify(hata=f"Girdi detayı alınamadı: {str(e)}"), 500


@sut_bp.route('/api/<int:girdi_id>/guncelle', methods=['PUT'])
@login_required
@role_required('firma_admin') # Sadece admin güncelleyebilir
def sut_guncelle(girdi_id):
    """
    Bir süt girdisini günceller (Modal'dan).
    """
    try:
        data = request.json
        
        # Gerekli alanların kontrolü
        tedarikci_id = parse_int_or_none(data.get('tedarikci_id'))
        litre = parse_decimal_or_none(data.get('litre'))
        
        if not all([tedarikci_id, litre]):
            return jsonify(hata="Eksik veya geçersiz veri: Tedarikçi ve litre zorunludur."), 400

        # Opsiyonel alanlar
        taplanma_tarihi_str = data.get('taplanma_tarihi')
        fiyat = parse_decimal_or_none(data.get('fiyat'))
        satis_fiyati = parse_decimal_or_none(data.get('satis_fiyati')) # Karlılık için
        tanker_id = parse_int_or_none(data.get('tanker_id'))

        guncellenen_girdi, error = sut_service.update_sut_girdisi(
            girdi_id=girdi_id,
            tedarikci_id=tedarikci_id,
            litre=litre,
            taplanma_tarihi_str=taplanma_tarihi_str,
            fiyat=fiyat,
            satis_fiyati=satis_fiyati,
            tanker_id=tanker_id
        )
        
        if error:
            if "bulunamadı" in error or "yetkiniz yok" in error:
                return jsonify(hata=error), 404
            return jsonify(hata=error), 500
            
        return jsonify(mesaj="Süt girdisi başarıyla güncellendi.", girdi=guncellenen_girdi), 200

    except Exception as e:
        current_app.logger.error(f"Süt güncelleme hatası (ID: {girdi_id}): {e}", exc_info=True)
        return jsonify(hata=f"Süt girdisi güncellenemedi: {str(e)}"), 500


# --- HATA ÇIKIŞI YAPAN KOD ---
# Çift tanımlandığı için çakışmaya neden olan 'decorator' fonksiyonu kaldırıldı.
from flask import Blueprint, render_template, request, jsonify, g, current_app
from decorators import login_required, role_required
from services.finans_service import FinansService
from utils import parse_int_or_none, parse_decimal_or_none, parse_date_or_none

finans_bp = Blueprint('finans', __name__)
finans_service = FinansService()


# --- 1. HTML Sayfa Rotası ---

@finans_bp.route('/')
@login_required
@role_required('firma_admin', 'firma_calisan')
def finans_yonetimi_sayfasi():
    """Finans yönetimi (Ödemeler/Tahsilatlar) listeleme sayfasını render eder."""
    return render_template('finans_yonetimi.html')


# --- 2. API ROTALARI ---

@finans_bp.route('/api/ekle', methods=['POST'])
@login_required
@role_required('firma_admin', 'firma_calisan')
def finans_ekle():
    """
    Hızlı İşlem modalından yeni finansal işlem (Ödeme/Tahsilat) ekler.
    """
    try:
        data = request.json
        sirket_id = g.user.sirket_id
        kullanici_id = g.user.id # UUID
        
        # Gerekli alanların kontrolü
        tedarikci_id = parse_int_or_none(data.get('tedarikci_id'))
        islem_tipi = data.get('islem_tipi')
        tutar = parse_decimal_or_none(data.get('tutar'))
        
        if not all([tedarikci_id, islem_tipi, tutar]):
            return jsonify(hata="Eksik veya geçersiz veri: Tedarikçi, işlem tipi ve tutar zorunludur."), 400
        
        # 'Odeme' veya 'Tahsilat' olmalı
        if islem_tipi not in ['Odeme', 'Tahsilat']:
             return jsonify(hata=f"Geçersiz işlem tipi: {islem_tipi}"), 400

        # Opsiyonel alanlar
        islem_tarihi_str = data.get('islem_tarihi')
        aciklama = data.get('aciklama')
        
        yeni_islem, error = finans_service.create_finansal_islem(
            sirket_id=sirket_id,
            kullanici_id=kullanici_id,
            tedarikci_id=tedarikci_id,
            islem_tipi=islem_tipi,
            tutar=tutar,
            islem_tarihi_str=islem_tarihi_str,
            aciklama=aciklama
        )
        
        if error:
            return jsonify(hata=error), 500
            
        return jsonify(mesaj="Finansal işlem başarıyla eklendi.", islem=yeni_islem), 201

    except Exception as e:
        current_app.logger.error(f"Finans ekleme hatası: {e}", exc_info=True)
        return jsonify(hata=f"Finansal işlem eklenemedi: {str(e)}"), 500


@finans_bp.route('/api/listele', methods=['GET'])
@login_required
@role_required('firma_admin', 'firma_calisan')
def finans_listele():
    """
    Finans yönetimi sayfası için işlemleri (Ödeme/Tahsilat) listeler.
    """
    try:
        sirket_id = g.user.sirket_id
        
        # Filtreleme parametreleri
        sayfa = parse_int_or_none(request.args.get('sayfa')) or 1
        limit = parse_int_or_none(request.args.get('limit')) or 10
        tedarikci_id = parse_int_or_none(request.args.get('tedarikci_id'))
        baslangic_tarihi = parse_date_or_none(request.args.get('baslangic_tarihi'))
        bitis_tarihi = parse_date_or_none(request.args.get('bitis_tarihi'))
        islem_tipi = request.args.get('islem_tipi') # 'Odeme', 'Tahsilat' veya 'Hepsi' (None)

        if islem_tipi == 'Hepsi':
            islem_tipi = None

        data, count, error = finans_service.get_finansal_islemler_paginated(
            sirket_id=sirket_id,
            sayfa=sayfa,
            limit=limit,
            tedarikci_id=tedarikci_id,
            baslangic_tarihi=baslangic_tarihi,
            bitis_tarihi=bitis_tarihi,
            islem_tipi=islem_tipi
        )
        
        if error:
            return jsonify(hata=error), 500

        return jsonify({
            'islemler': data,
            'toplam_kayit': count,
            'sayfa': sayfa
        }), 200

    except Exception as e:
        current_app.logger.error(f"Finans listeleme hatası: {e}", exc_info=True)
        return jsonify(hata=f"Finansal işlemler listelenemedi: {str(e)}"), 500


@finans_bp.route('/api/<int:islem_id>/sil', methods=['DELETE'])
@login_required
@role_required('firma_admin') # Sadece admin silebilir
def finans_sil(islem_id):
    """
    Bir finansal işlemi siler. (RLS kontrolü devrede)
    """
    try:
        success, error = finans_service.delete_finansal_islem(islem_id)
        
        if error:
            if "bulunamadı" in error or "yetkiniz yok" in error:
                return jsonify(hata=error), 404
            return jsonify(hata=error), 500
            
        return jsonify(mesaj="Finansal işlem başarıyla silindi."), 200

    except Exception as e:
        current_app.logger.error(f"Finans silme hatası (ID: {islem_id}): {e}", exc_info=True)
        return jsonify(hata=f"Finansal işlem silinemedi: {str(e)}"), 500


@finans_bp.route('/api/<int:islem_id>/detay', methods=['GET'])
@login_required
@role_required('firma_admin', 'firma_calisan')
def get_finans_detay(islem_id):
    """
    Bir finansal işlemin detayını (düzenleme modalı için) getirir.
    """
    try:
        data, error = finans_service.get_finansal_islem_by_id(islem_id)
        
        if error:
             return jsonify(hata=error), 404
        
        return jsonify(data), 200

    except Exception as e:
        current_app.logger.error(f"Finans detay hatası (ID: {islem_id}): {e}", exc_info=True)
        return jsonify(hata=f"İşlem detayı alınamadı: {str(e)}"), 500


@finans_bp.route('/api/<int:islem_id>/guncelle', methods=['PUT'])
@login_required
@role_required('firma_admin') # Sadece admin güncelleyebilir
def finans_guncelle(islem_id):
    """
    Bir finansal işlemi günceller (Modal'dan).
    """
    try:
        data = request.json
        
        # Gerekli alanların kontrolü
        tedarikci_id = parse_int_or_none(data.get('tedarikci_id'))
        islem_tipi = data.get('islem_tipi')
        tutar = parse_decimal_or_none(data.get('tutar'))
        
        if not all([tedarikci_id, islem_tipi, tutar]):
            return jsonify(hata="Eksik veya geçersiz veri: Tedarikçi, işlem tipi ve tutar zorunludur."), 400

        # Opsiyonel alanlar
        islem_tarihi_str = data.get('islem_tarihi')
        aciklama = data.get('aciklama')

        guncellenen_islem, error = finans_service.update_finansal_islem(
            islem_id=islem_id,
            tedarikci_id=tedarikci_id,
            islem_tipi=islem_tipi,
            tutar=tutar,
            islem_tarihi_str=islem_tarihi_str,
            aciklama=aciklama
        )
        
        if error:
            if "bulunamadı" in error or "yetkiniz yok" in error:
                return jsonify(hata=error), 404
            return jsonify(hata=error), 500
            
        return jsonify(mesaj="Finansal işlem başarıyla güncellendi.", islem=guncellenen_islem), 200

    except Exception as e:
        current_app.logger.error(f"Finans güncelleme hatası (ID: {islem_id}): {e}", exc_info=True)
        return jsonify(hata=f"Finansal işlem güncellenemedi: {str(e)}"), 500


# --- HATA ÇIKIŞI YAPAN KOD ---
# Çift tanımlandığı için çakışmaya neden olan 'decorator' fonksiyonu kaldırıldı.
# Dosya: blueprints/tedarikci.py (PDF Gruplama Mantığı Eklendi)

from flask import Blueprint, jsonify, request, session, render_template, current_app, send_file
from decorators import login_required, lisans_kontrolu, modification_allowed
from extensions import supabase, turkey_tz
from utils import parse_supabase_timestamp
from decimal import Decimal
from datetime import datetime
import pytz
import calendar
import io
from postgrest import APIError
from collections import defaultdict

tedarikci_bp = Blueprint('tedarikci', __name__, url_prefix='/api')

# --- HIZLI ENDPOINT'LER (Değişiklik yok) ---
# BU YENİ FONKSİYONU OLDUĞU GİBİ EKLE
@tedarikci_bp.route('/tedarikciler_dropdown')
@login_required
def get_tedarikciler_for_dropdown():
    """Sadece ID ve İsim içeren, sıralanmış tam tedarikçi listesini döndürür."""
    try:
        sirket_id = session['user']['sirket_id']
        # DÜZELTME: Hatalı olan 'asc=True' kullanımı 'desc=False' olarak değiştirildi.
        response = supabase.table('tedarikciler').select('id, isim').eq('sirket_id', sirket_id).order('isim', desc=False).execute()
        return jsonify(response.data)
    except Exception as e:
        print(f"Dropdown için tedarikçi listesi hatası: {e}")
        return jsonify({"error": "Liste alınamadı."}), 500
    
@tedarikci_bp.route('/tedarikci/<int:id>')
@login_required
def get_tedarikci_detay(id):
    """Tek bir tedarikçinin tüm detaylarını ID ile getirir."""
    try:
        sirket_id = session['user']['sirket_id']
        response = supabase.table('tedarikciler').select(
            'id, isim, tc_no, telefon_no, adres'
        ).eq('id', id).eq('sirket_id', sirket_id).single().execute()

        if not response.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya bu tedarikçiyi görme yetkiniz yok."}), 404

        return jsonify(response.data)
    except Exception as e:
        print(f"Tedarikçi detay hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/ozet')
@login_required
def get_tedarikci_ozet(tedarikci_id):
    try:
        sirket_id = session['user']['sirket_id']
        response = supabase.table('tedarikciler').select(
            'isim, sut_girdileri(litre, fiyat), yem_islemleri(toplam_tutar), finansal_islemler(tutar)'
        ).eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
        if not response.data:
            return jsonify({"error": "Tedarikçi bulunamadı."}), 404
        td = response.data
        toplam_sut_alacagi = sum(Decimal(str(g.get('litre', '0'))) * Decimal(str(g.get('fiyat', '0'))) for g in td.get('sut_girdileri', []))
        toplam_yem_borcu = sum(Decimal(str(y.get('toplam_tutar', '0'))) for y in td.get('yem_islemleri', []))
        toplam_odeme = sum(Decimal(str(f.get('tutar', '0'))) for f in td.get('finansal_islemler', []))
        net_bakiye = toplam_sut_alacagi - toplam_yem_borcu - toplam_odeme
        sonuc = {
            "isim": td.get('isim', 'Bilinmeyen Tedarikçi'),
            "toplam_sut_alacagi": f"{toplam_sut_alacagi:.2f}",
            "toplam_yem_borcu": f"{toplam_yem_borcu:.2f}",
            "toplam_odeme": f"{toplam_odeme:.2f}",
            "net_bakiye": f"{net_bakiye:.2f}"
        }
        return jsonify(sonuc)
    except Exception as e:
        print(f"Tedarikçi özet hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir özet hatası oluştu."}), 500

# ... (get_sut_girdileri_sayfali, get_yem_islemleri_sayfali, get_finansal_islemler_sayfali fonksiyonları değişiklik olmadan kalır)
@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/sut_girdileri')
@login_required
def get_sut_girdileri_sayfali(tedarikci_id):
    """Tedarikçinin süt girdilerini sayfalayarak getirir."""
    try:
        sayfa = int(request.args.get('sayfa', 1))
        limit = 10
        offset = (sayfa - 1) * limit
        sirket_id = session['user']['sirket_id']
        query = supabase.table('sut_girdileri').select(
            '*, kullanicilar(kullanici_adi)', count='exact'
        ).eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order(
            'taplanma_tarihi', desc=True
        ).range(offset, offset + limit - 1)
        response = query.execute()
        return jsonify({"girdiler": response.data, "toplam_kayit": response.count})
    except Exception as e:
        print(f"Sayfalı süt girdisi hatası: {e}")
        return jsonify({"error": "Süt girdileri listelenemedi."}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/yem_islemleri')
@login_required
def get_yem_islemleri_sayfali(tedarikci_id):
    """Tedarikçinin yem işlemlerini sayfalayarak getirir."""
    try:
        sayfa = int(request.args.get('sayfa', 1))
        limit = 10
        offset = (sayfa - 1) * limit
        sirket_id = session['user']['sirket_id']
        query = supabase.table('yem_islemleri').select(
            '*, kullanicilar(kullanici_adi), yem_urunleri(yem_adi)', count='exact'
        ).eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order(
            'islem_tarihi', desc=True
        ).range(offset, offset + limit - 1)
        response = query.execute()
        return jsonify({"islemler": response.data, "toplam_kayit": response.count})
    except Exception as e:
        print(f"Sayfalı yem işlemi hatası: {e}")
        return jsonify({"error": "Yem işlemleri listelenemedi."}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/finansal_islemler')
@login_required
def get_finansal_islemler_sayfali(tedarikci_id):
    """Tedarikçinin finansal işlemlerini sayfalayarak getirir."""
    try:
        sayfa = int(request.args.get('sayfa', 1))
        limit = 10
        offset = (sayfa - 1) * limit
        sirket_id = session['user']['sirket_id']
        query = supabase.table('finansal_islemler').select(
            '*, kullanicilar(kullanici_adi)', count='exact'
        ).eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order(
            'islem_tarihi', desc=True
        ).range(offset, offset + limit - 1)
        response = query.execute()
        return jsonify({"islemler": response.data, "toplam_kayit": response.count})
    except Exception as e:
        print(f"Sayfalı finans işlemi hatası: {e}")
        return jsonify({"error": "Finansal işlemler listelenemedi."}), 500


@tedarikci_bp.route('/tedarikci_ekle', methods=['POST'])
@login_required
@lisans_kontrolu
@modification_allowed
def add_tedarikci():
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        isim = data.get('isim')
        if not isim:
            return jsonify({"error": "Tedarikçi ismi zorunludur."}), 400
        yeni_veri = {'isim': isim, 'sirket_id': sirket_id}
        if data.get('tc_no'): yeni_veri['tc_no'] = data.get('tc_no')
        if data.get('telefon_no'): yeni_veri['telefon_no'] = data.get('telefon_no')
        if data.get('adres'): yeni_veri['adres'] = data.get('adres')

        # DEĞİŞİKLİK: Sunucudan dönen veriyi yakala
        response = supabase.table('tedarikciler').insert(yeni_veri).execute()

        # DEĞİŞİKLİK: Mesajla birlikte yeni eklenen tedarikçiyi de frontend'e gönder
        return jsonify({"message": "Tedarikçi başarıyla eklendi.", "tedarikci": response.data[0]}), 201

    except APIError as e:
        return jsonify({"error": f"Veritabanı hatası: {e.message}"}), 500
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@tedarikci_bp.route('/tedarikci_duzenle/<int:id>', methods=['PUT'])
@login_required
@lisans_kontrolu
@modification_allowed
def update_tedarikci(id):
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        guncellenecek_veri = {}
        if 'isim' in data and data.get('isim'):
            guncellenecek_veri['isim'] = data.get('isim')
        else:
             return jsonify({"error": "Tedarikçi ismi boş bırakılamaz."}), 400
        if 'tc_no' in data: guncellenecek_veri['tc_no'] = data.get('tc_no')
        if 'telefon_no' in data: guncellenecek_veri['telefon_no'] = data.get('telefon_no')
        if 'adres' in data: guncellenecek_veri['adres'] = data.get('adres')
        if not guncellenecek_veri:
            return jsonify({"error": "Güncellenecek veri bulunamadı."}), 400

        # DEĞİŞİKLİK: Sunucudan dönen veriyi yakala
        response = supabase.table('tedarikciler').update(guncellenecek_veri).eq('id', id).eq('sirket_id', sirket_id).execute()

        if not response.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya bu işlem için yetkiniz yok."}), 404

        # DEĞİŞİKLİK: Mesajla birlikte güncellenen tedarikçiyi de frontend'e gönder
        return jsonify({"message": "Tedarikçi bilgileri güncellendi.", "tedarikci": response.data[0]})

    except APIError as e:
        return jsonify({"error": f"Veritabanı hatası: {e.message}"}), 500
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@tedarikci_bp.route('/tedarikci_sil/<int:id>', methods=['DELETE'])
@login_required
@lisans_kontrolu
@modification_allowed
def delete_tedarikci(id):
    try:
        sirket_id = session['user']['sirket_id']
        response = supabase.table('tedarikciler').delete().eq('id', id).eq('sirket_id', sirket_id).execute()
        if not response.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya bu işlem için yetkiniz yok."}), 404
        return jsonify({"message": "Tedarikçi başarıyla silindi."})
    except Exception as e:
        if 'violates foreign key constraint' in str(e).lower():
            return jsonify({"error": "Bu tedarikçiye ait süt veya yem girdisi olduğu için silinemiyor."}), 409
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@tedarikci_bp.route('/tedarikciler_liste')
@login_required
def get_tedarikciler_liste():
    """Tüm tedarikçileri SAYFALAMALI, SIRALAMALI ve ARANABİLİR şekilde listeler."""
    try:
        sirket_id = session['user']['sirket_id']

        # 1. Frontend'den gelen parametreleri al
        sayfa = int(request.args.get('sayfa', 1))
        limit = 15 # Frontend ile aynı olmalı
        offset = (sayfa - 1) * limit

        arama = request.args.get('arama', '').strip()
        siralama_sutun = request.args.get('siralamaSutun', 'isim')
        siralama_yon = request.args.get('siralamaYon', 'asc')

        # 2. Ana sorguyu oluştur
        query = supabase.table('tedarikci_ozetleri').select(
            'id, isim, telefon_no, toplam_litre', count='exact'
        ).eq('sirket_id', sirket_id)

        # 3. Arama filtresini ekle (isim veya telefonda arama yapar)
        if arama:
            query = query.or_(f'isim.ilike.%{arama}%,telefon_no.ilike.%{arama}%')

        # 4. Sıralamayı ekle
        is_desc = siralama_yon == 'desc'
        # Güvenlik için sıralanabilir sütunları beyaz listeye alalım
        izin_verilen_sutunlar = ['isim', 'toplam_litre']
        if siralama_sutun not in izin_verilen_sutunlar:
            siralama_sutun = 'isim' # Varsayılana dön
            
        query = query.order(siralama_sutun, desc=is_desc)

        # 5. Sayfalamayı uygula ve sorguyu çalıştır
        response = query.range(offset, offset + limit - 1).execute()

        # 6. Sonucu frontend'e gönder
        return jsonify({
            "tedarikciler": response.data,
            "toplam_kayit": response.count
        })

    except Exception as e:
        print(f"Tedarikçi listesi hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500
        


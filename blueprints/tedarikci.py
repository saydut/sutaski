# Dosya: blueprints/tedarikci.py (PDF Gruplama Mantığı Eklendi)

from flask import Blueprint, jsonify, request, session, render_template, current_app, send_file
from decorators import login_required, lisans_kontrolu, modification_allowed
from extensions import supabase, turkey_tz
from utils import parse_supabase_timestamp
from decimal import Decimal
from datetime import datetime
import pytz
import calendar
from weasyprint import HTML
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
        response = supabase.table('tedarikciler').select('id, isim').eq('sirket_id', sirket_id).order('isim', asc=True).execute()
        return jsonify(response.data)
    except Exception as e:
        print(f"Dropdown için tedarikçi listesi hatası: {e}")
        return jsonify({"error": "Liste alınamadı."}), 500

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

# ... (add_tedarikci, update_tedarikci, delete_tedarikci, get_tedarikciler_liste fonksiyonları değişiklik olmadan kalır)
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
        supabase.table('tedarikciler').insert(yeni_veri).execute()
        return jsonify({"message": "Tedarikçi başarıyla eklendi."}), 201
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
        response = supabase.table('tedarikciler').update(guncellenecek_veri).eq('id', id).eq('sirket_id', sirket_id).execute()
        if not response.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya bu işlem için yetkiniz yok."}), 404
        return jsonify({"message": "Tedarikçi bilgileri güncellendi."})
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
    """Tedarikçiler sayfasındaki ana listeyi sayfalama, arama ve sıralama yaparak getirir."""
    try:
        sirket_id = session['user']['sirket_id']
        
        # Frontend'den gelen parametreleri al
        sayfa = int(request.args.get('sayfa', 1))
        limit = 15  # Sayfa başına 15 tedarikçi gösterelim
        offset = (sayfa - 1) * limit
        arama_terimi = request.args.get('arama', '')
        sirala_sutun = request.args.get('sirala', 'isim')
        sirala_yon = request.args.get('yon', 'asc')

        # Ana sorguyu oluştur
        query = supabase.table('tedarikciler').select(
            'id, isim, telefon_no, tc_no, adres, sut_girdileri!left(litre)', 
            count='exact'
        ).eq('sirket_id', sirket_id)

        # Arama terimi varsa sorguya ekle
        if arama_terimi:
            # Hem isimde hem de telefon numarasında ara
            query = query.ilike('isim', f'%{arama_terimi}%')

        # Sıralama ve sayfalama uygula
        descending = sirala_yon == 'desc'
        query = query.order(sirala_sutun, desc=descending).range(offset, offset + limit - 1)
        
        response = query.execute()

        if not response.data:
            return jsonify({"tedarikciler": [], "toplam_kayit": 0})

        # Süt litrelerini Python'da toplayalım
        formatted_data = []
        for r in response.data:
            total_litre = sum(Decimal(g['litre']) for g in r.get('sut_girdileri', []) if g.get('litre') is not None)
            formatted_data.append({
                'id': r['id'], 'isim': r['isim'], 'telefon_no': r['telefon_no'],
                'tc_no': r['tc_no'], 'adres': r['adres'],
                'toplam_litre': float(total_litre)
            })
        
        return jsonify({"tedarikciler": formatted_data, "toplam_kayit": response.count})
    except Exception as e:
        print(f"Tedarikçi listesi hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500
        
# --- PDF OLUŞTURMA İÇİN YARDIMCI VE ANA FONKSİYONLAR ---

# --- DEĞİŞİKLİK BU FONKSİYONDA BAŞLIYOR ---
def _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil):
    """Belirtilen ay içindeki tüm verileri PDF için tek seferde çeker ve süt girdilerini gruplar."""
    _, ayin_son_gunu = calendar.monthrange(yil, ay)
    baslangic_tarihi = datetime(yil, ay, 1).date()
    bitis_tarihi = datetime(yil, ay, ayin_son_gunu).date()
    start_utc = turkey_tz.localize(datetime.combine(baslangic_tarihi, datetime.min.time())).astimezone(pytz.utc).isoformat()
    end_utc = turkey_tz.localize(datetime.combine(bitis_tarihi, datetime.max.time())).astimezone(pytz.utc).isoformat()

    sut_response = supabase.table('sut_girdileri').select('litre, fiyat, taplanma_tarihi').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc).order('taplanma_tarihi', desc=False).execute()
    yem_response = supabase.table('yem_islemleri').select('islem_tarihi, miktar_kg, islem_anindaki_birim_fiyat, toplam_tutar, yem_urunleri(yem_adi)').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).gte('islem_tarihi', start_utc).lte('islem_tarihi', end_utc).order('islem_tarihi', desc=False).execute()
    finans_response = supabase.table('finansal_islemler').select('islem_tarihi, islem_tipi, tutar, aciklama').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).gte('islem_tarihi', start_utc).lte('islem_tarihi', end_utc).order('islem_tarihi', desc=False).execute()

    # Süt girdilerini tarih ve fiyata göre gruplamak için bir sözlük (dictionary) oluşturalım.
    gruplanmis_girdiler = defaultdict(lambda: {'litre': Decimal(0)})

    for girdi in sut_response.data:
        parsed_date = parse_supabase_timestamp(girdi.get('taplanma_tarihi'))
        if not parsed_date: continue
        
        tarih_str = parsed_date.astimezone(turkey_tz).strftime('%d.%m.%Y')
        fiyat = Decimal(str(girdi.get('fiyat', '0')))
        litre = Decimal(str(girdi.get('litre', '0')))
        
        # Anahtar olarak tarih ve fiyatı birlikte kullanıyoruz
        grup_anahtari = (tarih_str, fiyat)
        gruplanmis_girdiler[grup_anahtari]['litre'] += litre

    # Gruplanmış veriyi şablonun beklediği formata dönüştürelim
    toplam_sut_tutari = Decimal('0.0')
    islenmis_sut_girdileri = []
    for (tarih, fiyat), data in gruplanmis_girdiler.items():
        litre = data['litre']
        tutar = litre * fiyat
        toplam_sut_tutari += tutar
        islenmis_sut_girdileri.append({
            "tarih": tarih,
            "litre": litre,
            "fiyat": fiyat,
            "toplam_tutar": tutar,
            "tutar": tutar # Müstahsil şablonu için de ekleyelim
        })
    
    # Tarihe göre sıralayalım
    islenmis_sut_girdileri.sort(key=lambda x: datetime.strptime(x['tarih'], '%d.%m.%Y'))
    
    toplam_yem_borcu = sum(Decimal(str(islem.get('toplam_tutar', '0'))) for islem in yem_response.data)
    toplam_odeme = sum(Decimal(str(islem.get('tutar', '0'))) for islem in finans_response.data)
    
    return {
        "sut_girdileri": islenmis_sut_girdileri,
        "yem_islemleri": yem_response.data,
        "finansal_islemler": finans_response.data,
        "ozet": { "toplam_sut_tutari": toplam_sut_tutari, "toplam_yem_borcu": toplam_yem_borcu, "toplam_odeme": toplam_odeme }
    }
# --- DEĞİŞİKLİK BU FONKSİYONDA BİTİYOR ---

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/hesap_ozeti_pdf')
@login_required
@lisans_kontrolu
def tedarikci_hesap_ozeti_pdf(tedarikci_id):
    try:
        sirket_id = session['user']['sirket_id']
        sirket_adi = session['user'].get('sirket_adi', 'Bilinmeyen Şirket')
        ay = int(request.args.get('ay'))
        yil = int(request.args.get('yil'))
        tedarikci_res = supabase.table('tedarikciler').select('isim').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
        if not tedarikci_res.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya yetkiniz yok."}), 404
        veri = _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil)
        net_bakiye = veri["ozet"]["toplam_sut_tutari"] - veri["ozet"]["toplam_yem_borcu"] - veri["ozet"]["toplam_odeme"]
        ozet = {
            'toplam_sut_alacagi': veri["ozet"]["toplam_sut_tutari"],
            'toplam_yem_borcu': veri["ozet"]["toplam_yem_borcu"],
            'toplam_odeme': veri["ozet"]["toplam_odeme"],
            'net_bakiye': net_bakiye
        }
        aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
        rapor_basligi = f"{aylar[ay-1]} {yil} Hesap Özeti"
        def format_tarih_filter(timestamp_str):
            dt = parse_supabase_timestamp(timestamp_str)
            return dt.astimezone(turkey_tz).strftime('%d.%m.%Y') if dt else ''
        current_app.jinja_env.filters['format_tarih'] = format_tarih_filter
        html_out = render_template('tedarikci_hesap_ozeti_pdf.html', rapor_basligi=rapor_basligi, sirket_adi=sirket_adi, tedarikci_adi=tedarikci_res.data['isim'], olusturma_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y %H:%M'), ozet=ozet, sut_girdileri=veri["sut_girdileri"], yem_islemleri=veri["yem_islemleri"], finansal_islemler=veri["finansal_islemler"])
        pdf_bytes = HTML(string=html_out, base_url=current_app.root_path).write_pdf()
        filename = f"{yil}_{ay:02d}_{tedarikci_res.data['isim'].replace(' ', '_')}_hesap_ozeti.pdf"
        return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=filename)
    except Exception as e:
        print(f"Hesap özeti PDF hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/mustahsil_makbuzu_pdf')
@login_required
@lisans_kontrolu
def tedarikci_mustahsil_makbuzu_pdf(tedarikci_id):
    try:
        sirket_id = session['user']['sirket_id']
        ay = int(request.args.get('ay'))
        yil = int(request.args.get('yil'))
        tedarikci_res = supabase.table('tedarikciler').select('isim, tc_no, adres').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
        sirket_res = supabase.table('sirketler').select('sirket_adi, adres, vergi_kimlik_no').eq('id', sirket_id).single().execute()
        if not tedarikci_res.data or not sirket_res.data:
            return jsonify({"error": "Gerekli şirket veya tedarikçi bilgisi bulunamadı."}), 404
        veri = _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil)
        stopaj_orani = Decimal('0.02')
        stopaj_tutari = veri["ozet"]["toplam_sut_tutari"] * stopaj_orani
        net_odenecek = (veri["ozet"]["toplam_sut_tutari"] - stopaj_tutari) - veri["ozet"]["toplam_yem_borcu"] - veri["ozet"]["toplam_odeme"]
        veri["ozet"]["stopaj_tutari"] = stopaj_tutari
        veri["ozet"]["net_odenecek"] = net_odenecek
        def format_tarih_filter(timestamp_str):
            dt = parse_supabase_timestamp(timestamp_str)
            return dt.astimezone(turkey_tz).strftime('%d.%m.%Y') if dt else ''
        current_app.jinja_env.filters['format_tarih'] = format_tarih_filter
        html_out = render_template('mustahsil_makbuzu_pdf.html', sirket=sirket_res.data, tedarikci=tedarikci_res.data, makbuz_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y'), sut_girdileri=veri["sut_girdileri"], yem_islemleri=veri["yem_islemleri"], finansal_islemler=veri["finansal_islemler"], ozet=veri["ozet"], stopaj_orani=stopaj_orani)
        pdf_bytes = HTML(string=html_out, base_url=current_app.root_path).write_pdf()
        filename = f"{yil}_{ay:02d}_{tedarikci_res.data['isim'].replace(' ', '_')}_mustahsil.pdf"
        return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=filename)
    except Exception as e:
        print(f"Müstahsil PDF hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500
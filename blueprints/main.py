from flask import Blueprint, jsonify, render_template, request, session, send_file, Response
from decorators import login_required, lisans_kontrolu, modification_allowed 
from extensions import supabase, turkey_tz, bcrypt
from datetime import datetime, timedelta
import pytz
import io
import csv
import calendar
from weasyprint import HTML, CSS

main_bp = Blueprint(
    'main', 
    __name__,
    template_folder='../../templates',
    static_folder='../../static'
)

# --- ARAYÜZ SAYFALARI ---
@main_bp.route('/')
@login_required
@lisans_kontrolu
def anasayfa():
    return render_template('index.html', session=session)

@main_bp.route('/raporlar')
@login_required
@lisans_kontrolu
def raporlar_page():
    return render_template('raporlar.html')

@main_bp.route('/tedarikciler')
@login_required
@lisans_kontrolu
def tedarikciler_sayfasi():
    return render_template('tedarikciler.html')

@main_bp.route('/tedarikci/<int:tedarikci_id>')
@login_required
@lisans_kontrolu
def tedarikci_detay_sayfasi(tedarikci_id):
    return render_template('tedarikci_detay.html', tedarikci_id=tedarikci_id)


# --- API'LER ---

# GÜNCELLENDİ: Tedarikçi Detay API'si artık sayfalama yapıyor
@main_bp.route('/api/tedarikci/<int:tedarikci_id>/detay')
@login_required
def get_tedarikci_detay(tedarikci_id):
    try:
        sirket_id = session['user']['sirket_id']
        sayfa = int(request.args.get('sayfa', 1))
        limit = 10  # Sayfa başına gösterilecek girdi sayısı
        offset = (sayfa - 1) * limit

        tedarikci_res = supabase.table('tedarikciler').select('isim').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
        if not tedarikci_res.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya yetkiniz yok."}), 404

        # Toplam girdi sayısını al
        count_res = supabase.table('sut_girdileri').select('id', count='exact').eq('tedarikci_id', tedarikci_id).execute()
        toplam_girdi_sayisi = count_res.count

        # Sadece istenen sayfadaki girdileri çek
        girdiler_res = supabase.table('sut_girdileri') \
            .select('litre, taplanma_tarihi, kullanicilar(kullanici_adi)') \
            .eq('tedarikci_id', tedarikci_id) \
            .order('taplanma_tarihi', desc=True) \
            .range(offset, offset + limit - 1) \
            .execute()
        girdiler = girdiler_res.data
        
        # Özet istatistikler (tüm girdiler üzerinden hesaplanır)
        ozet_res = supabase.table('sut_girdileri').select('litre, taplanma_tarihi').eq('tedarikci_id', tedarikci_id).order('taplanma_tarihi', desc=True).execute()
        tum_girdiler_ozet = ozet_res.data
        
        toplam_litre = sum(g['litre'] for g in tum_girdiler_ozet)
        girdi_sayisi = len(tum_girdiler_ozet)
        ortalama_litre = toplam_litre / girdi_sayisi if girdi_sayisi > 0 else 0
        ilk_girdi_tarihi = ''
        if tum_girdiler_ozet:
            ilk_girdi_tarihi = datetime.fromisoformat(tum_girdiler_ozet[-1]['taplanma_tarihi']).strftime('%d.%m.%Y')
        
        sonuc = {
            "id": tedarikci_id,
            "isim": tedarikci_res.data['isim'],
            "girdiler": girdiler,
            "toplam_girdi_sayisi": toplam_girdi_sayisi,
            "ozet": {
                "toplam_litre": toplam_litre,
                "girdi_sayisi": girdi_sayisi,
                "ortalama_litre": ortalama_litre,
                "ilk_girdi_tarihi": ilk_girdi_tarihi
            }
        }
        return jsonify(sonuc)
    except Exception as e:
        print(f"Tedarikçi detay hatası: {e}")
        return jsonify({"error": "Veri alınırken sunucu hatası oluştu."}), 500

# GÜNCELLENDİ: Süt Girdileri API'si artık sayfalama yapıyor
@main_bp.route('/api/sut_girdileri', methods=['GET'])
@login_required
def get_sut_girdileri():
    try:
        sirket_id = session['user']['sirket_id']
        secilen_tarih_str = request.args.get('tarih')
        sayfa = int(request.args.get('sayfa', 1))
        limit = 6
        offset = (sayfa - 1) * limit

        query = supabase.table('sut_girdileri').select(
            'id,litre,taplanma_tarihi,duzenlendi_mi,kullanicilar(kullanici_adi),tedarikciler(isim)',
            count='exact'
        ).eq('sirket_id', sirket_id)

        if secilen_tarih_str:
            target_date = datetime.strptime(secilen_tarih_str, '%Y-%m-%d').date()
            start_utc = turkey_tz.localize(datetime.combine(target_date, datetime.min.time())).astimezone(pytz.utc).isoformat()
            end_utc = turkey_tz.localize(datetime.combine(target_date, datetime.max.time())).astimezone(pytz.utc).isoformat()
            query = query.gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc)
        
        data = query.order('id', desc=True).range(offset, offset + limit - 1).execute()
        
        return jsonify({
            "girdiler": data.data,
            "toplam_girdi_sayisi": data.count
        })
    except Exception as e:
        print(f"Süt girdileri hatası: {e}")
        return jsonify({"error": "Girdiler alınırken bir hata oluştu."}), 500

# PDF OLUŞTURMA API'Sİ (Değişiklik yok)
@main_bp.route('/api/rapor/aylik_pdf')
@login_required
@lisans_kontrolu
def aylik_rapor_pdf():
    try:
        sirket_id = session['user']['sirket_id']
        sirket_adi = session['user'].get('sirket_adi', 'Bilinmeyen Şirket')
        ay = int(request.args.get('ay'))
        yil = int(request.args.get('yil'))
        _, ayin_son_gunu = calendar.monthrange(yil, ay)
        baslangic_tarihi = datetime(yil, ay, 1).date()
        bitis_tarihi = datetime(yil, ay, ayin_son_gunu).date()
        start_utc = turkey_tz.localize(datetime.combine(baslangic_tarihi, datetime.min.time())).astimezone(pytz.utc).isoformat()
        end_utc = turkey_tz.localize(datetime.combine(bitis_tarihi, datetime.max.time())).astimezone(pytz.utc).isoformat()
        response = supabase.table('sut_girdileri').select('litre, taplanma_tarihi, tedarikciler(isim)').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc).execute()
        girdiler = response.data
        gunluk_dokum_dict = {i: {'toplam_litre': 0, 'girdi_sayisi': 0} for i in range(1, ayin_son_gunu + 1)}
        tedarikci_dokumu_dict = {}
        for girdi in girdiler:
            girdi_tarihi_tr = datetime.fromisoformat(girdi['taplanma_tarihi']).astimezone(turkey_tz)
            gun = girdi_tarihi_tr.day
            gunluk_dokum_dict[gun]['toplam_litre'] += girdi['litre']
            gunluk_dokum_dict[gun]['girdi_sayisi'] += 1
            if girdi.get('tedarikciler') and girdi['tedarikciler'].get('isim'):
                isim = girdi['tedarikciler']['isim']
                if isim not in tedarikci_dokumu_dict:
                    tedarikci_dokumu_dict[isim] = {'toplam_litre': 0, 'girdi_sayisi': 0}
                tedarikci_dokumu_dict[isim]['toplam_litre'] += girdi['litre']
                tedarikci_dokumu_dict[isim]['girdi_sayisi'] += 1
        gunluk_dokum = [{'tarih': f"{day:02d}.{ay:02d}.{yil}", **data} for day, data in gunluk_dokum_dict.items()]
        tedarikci_dokumu = sorted([{'isim': isim, **data} for isim, data in tedarikci_dokumu_dict.items()], key=lambda x: x['toplam_litre'], reverse=True)
        toplam_litre = sum(g['litre'] for g in girdiler)
        ozet = {'toplam_litre': toplam_litre, 'girdi_sayisi': len(girdiler), 'gunluk_ortalama': toplam_litre / ayin_son_gunu if ayin_son_gunu > 0 else 0}
        aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
        rapor_basligi = f"{aylar[ay-1]} {yil} Süt Toplama Raporu"
        html_out = render_template('aylik_rapor_pdf.html', rapor_basligi=rapor_basligi, sirket_adi=sirket_adi, olusturma_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y %H:%M'), ozet=ozet, tedarikci_dokumu=tedarikci_dokumu, gunluk_dokum=gunluk_dokum)
        pdf_bytes = HTML(string=html_out, base_url='.').write_pdf()
        filename = f"{yil}_{ay:02d}_{sirket_adi.replace(' ', '_')}_raporu.pdf"
        return Response(pdf_bytes, mimetype='application/pdf', headers={'Content-Disposition': f'attachment; filename={filename}'})
    except Exception as e:
        print(f"PDF Rapor Hatası: {e}")
        return "Rapor oluşturulurken bir hata oluştu.", 500

# --- DİĞER API'LER (Değişiklik yok) ---

@main_bp.route('/api/tedarikciler_liste')
@login_required
def get_tedarikciler_liste():
    try:
        sirket_id = session['user']['sirket_id']
        tedarikciler_response = supabase.table('tedarikciler').select('id, isim').eq('sirket_id', sirket_id).execute()
        tedarikciler = tedarikciler_response.data
        girdiler_response = supabase.table('sut_girdileri').select('tedarikci_id, litre').eq('sirket_id', sirket_id).execute()
        girdiler = girdiler_response.data
        tedarikci_stats = {t['id']: {'isim': t['isim'], 'toplam_litre': 0, 'girdi_sayisi': 0} for t in tedarikciler}
        for girdi in girdiler:
            tid = girdi['tedarikci_id']
            if tid in tedarikci_stats:
                tedarikci_stats[tid]['toplam_litre'] += girdi['litre']
                tedarikci_stats[tid]['girdi_sayisi'] += 1
        sonuc = [{'id': tid, **stats} for tid, stats in tedarikci_stats.items()]
        sonuc_sirali = sorted(sonuc, key=lambda x: x['isim'])
        return jsonify(sonuc_sirali)
    except Exception as e:
        print(f"Tedarikçi liste hatası: {e}")
        return jsonify({"error": "Veri alınırken sunucu hatası oluştu."}), 500

@main_bp.route('/api/gunluk_ozet')
@login_required
def get_gunluk_ozet():
    try:
        sirket_id = session['user']['sirket_id']
        tarih_str = request.args.get('tarih')
        if tarih_str:
            target_date = datetime.strptime(tarih_str, '%Y-%m-%d').date()
        else:
            target_date = datetime.now(turkey_tz).date()
        start_time_tr = turkey_tz.localize(datetime.combine(target_date, datetime.min.time()))
        end_time_tr = turkey_tz.localize(datetime.combine(target_date, datetime.max.time()))
        start_time_utc = start_time_tr.astimezone(pytz.utc).isoformat()
        end_time_utc = end_time_tr.astimezone(pytz.utc).isoformat()
        response = supabase.table('sut_girdileri').select('litre').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_time_utc).lte('taplanma_tarihi', end_time_utc).execute()
        toplam_litre = sum(item['litre'] for item in response.data)
        return jsonify({'toplam_litre': round(toplam_litre, 2)})
    except Exception as e:
        print(f"Özet Hatası: {e}")
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/rapor/haftalik_ozet')
@login_required
def get_haftalik_ozet():
    try:
        sirket_id = session['user']['sirket_id']
        today = datetime.now(turkey_tz).date()
        turkce_aylar = {"Jan": "Oca", "Feb": "Şub", "Mar": "Mar", "Apr": "Nis","May": "May", "Jun": "Haz", "Jul": "Tem", "Aug": "Ağu","Sep": "Eyl", "Oct": "Eki", "Nov": "Kas", "Dec": "Ara"}
        labels, data = [], []
        for i in range(7):
            target_date = today - timedelta(days=i)
            gun, ay_ingilizce = target_date.strftime('%d %b').split()
            labels.append(f"{gun} {turkce_aylar.get(ay_ingilizce, ay_ingilizce)}")
            start_tr = turkey_tz.localize(datetime.combine(target_date, datetime.min.time()))
            end_tr = turkey_tz.localize(datetime.combine(target_date, datetime.max.time()))
            response = supabase.table('sut_girdileri').select('litre').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_tr.astimezone(pytz.utc).isoformat()).lte('taplanma_tarihi', end_tr.astimezone(pytz.utc).isoformat()).execute()
            data.append(round(sum(item['litre'] for item in response.data), 2))
        return jsonify({'labels': labels[::-1], 'data': data[::-1]})
    except Exception as e:
        print(f"Haftalık özet hatası: {e}")
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/rapor/tedarikci_dagilimi')
@login_required
def get_tedarikci_dagilimi():
    try:
        sirket_id = session['user']['sirket_id']
        start_date = datetime.now(turkey_tz).date() - timedelta(days=30)
        start_tr = turkey_tz.localize(datetime.combine(start_date, datetime.min.time()))
        response = supabase.table('sut_girdileri').select('litre, tedarikciler(isim)').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_tr.astimezone(pytz.utc).isoformat()).execute()
        dagilim = {}
        for girdi in response.data:
            if girdi.get('tedarikciler') and girdi['tedarikciler'].get('isim'):
                isim = girdi['tedarikciler']['isim']
                dagilim[isim] = dagilim.get(isim, 0) + girdi['litre']
        sorted_dagilim = dict(sorted(dagilim.items(), key=lambda item: item[1], reverse=True))
        return jsonify({'labels': list(sorted_dagilim.keys()), 'data': [round(v, 2) for v in sorted_dagilim.values()]})
    except Exception as e:
        print(f"Tedarikçi dağılım hatası: {e}")
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/rapor/detayli_rapor', methods=['GET'])
@login_required
def get_detayli_rapor():
    try:
        sirket_id = session['user']['sirket_id']
        start_date_str = request.args.get('baslangic')
        end_date_str = request.args.get('bitis')
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        if start_date > end_date or (end_date - start_date).days > 90:
            return jsonify({"error": "Geçersiz tarih aralığı."}), 400
        start_utc = turkey_tz.localize(datetime.combine(start_date, datetime.min.time())).astimezone(pytz.utc).isoformat()
        end_utc = turkey_tz.localize(datetime.combine(end_date, datetime.max.time())).astimezone(pytz.utc).isoformat()
        response = supabase.table('sut_girdileri').select('litre, taplanma_tarihi, tedarikciler(isim)').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc).execute()
        date_range = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
        daily_totals = {gun.strftime('%Y-%m-%d'): 0 for gun in date_range}
        supplier_totals = {}
        for girdi in response.data:
            girdi_gunu_str = datetime.fromisoformat(girdi['taplanma_tarihi']).astimezone(turkey_tz).strftime('%Y-%m-%d')
            if girdi_gunu_str in daily_totals:
                daily_totals[girdi_gunu_str] += girdi['litre']
            if girdi.get('tedarikciler') and girdi['tedarikciler'].get('isim'):
                isim = girdi['tedarikciler']['isim']
                if isim not in supplier_totals: supplier_totals[isim] = {'litre': 0, 'entryCount': 0}
                supplier_totals[isim]['litre'] += girdi['litre']
                supplier_totals[isim]['entryCount'] += 1
        turkce_aylar = {"01":"Oca","02":"Şub","03":"Mar","04":"Nis","05":"May","06":"Haz","07":"Tem","08":"Ağu","09":"Eyl","10":"Eki","11":"Kas","12":"Ara"}
        labels = [f"{datetime.strptime(gun, '%Y-%m-%d').strftime('%d')} {turkce_aylar.get(datetime.strptime(gun, '%Y-%m-%d').strftime('%m'), '')}" for gun in sorted(daily_totals.keys())]
        data = [round(toplam, 2) for gun, toplam in sorted(daily_totals.items())]
        total_litre = sum(daily_totals.values())
        summary = {'totalLitre': round(total_litre, 2), 'averageDailyLitre': round(total_litre / len(date_range) if date_range else 0, 2), 'dayCount': len(date_range), 'entryCount': len(response.data)}
        breakdown = sorted([{'name': isim, 'litre': round(totals['litre'], 2), 'entryCount': totals['entryCount']} for isim, totals in supplier_totals.items()], key=lambda x: x['litre'], reverse=True)
        return jsonify({'chartData': {'labels': labels, 'data': data}, 'summaryData': summary, 'supplierBreakdown': breakdown})
    except Exception as e:
        print(f"Detaylı rapor hatası: {e}")
        return jsonify({"error": "Rapor verisi alınırken bir hata oluştu."}), 500

@main_bp.route('/api/tedarikciler', methods=['GET'])
@login_required
def get_tedarikciler():
    sirket_id = session['user']['sirket_id']
    data = supabase.table('tedarikciler').select('*').eq('sirket_id', sirket_id).order('isim', desc=False).execute()
    return jsonify(data.data)

@main_bp.route('/api/girdi_gecmisi/<int:girdi_id>')
@login_required
def get_girdi_gecmisi(girdi_id):
    try:
        original_girdi_response = supabase.table('sut_girdileri').select('sirket_id').eq('id', girdi_id).single().execute()
        if not original_girdi_response.data or original_girdi_response.data['sirket_id'] != session['user']['sirket_id']:
            return jsonify({"error": "Yetkisiz erişim."}), 403
        gecmis_data = supabase.table('girdi_gecmisi').select('*,duzenleyen_kullanici_id(kullanici_adi)').eq('orijinal_girdi_id', girdi_id).order('created_at', desc=True).execute()
        return jsonify(gecmis_data.data)
    except Exception as e:
        print(f"Geçmiş Hatası: {e}")
        return jsonify({"error": str(e)}), 500

# --- VERİ DEĞİŞTİRME API'LERİ (Muhasebeci erişemez) ---

@main_bp.route('/api/tedarikci_ekle', methods=['POST'])
@login_required
@lisans_kontrolu
@modification_allowed
def add_tedarikci():
    yeni_tedarikci = request.get_json()
    sirket_id = session['user']['sirket_id']
    data = supabase.table('tedarikciler').insert({'isim': yeni_tedarikci['isim'], 'sirket_id': sirket_id}).execute()
    return jsonify({"status": "success", "data": data.data})

@main_bp.route('/api/sut_girdisi_ekle', methods=['POST'])
@login_required
@lisans_kontrolu
@modification_allowed
def add_sut_girdisi():
    yeni_girdi = request.get_json()
    data = supabase.table('sut_girdileri').insert({
        'tedarikci_id': yeni_girdi['tedarikci_id'],
        'litre': yeni_girdi['litre'],
        'kullanici_id': session['user']['id'],
        'sirket_id': session['user']['sirket_id']
    }).execute()
    return jsonify({"status": "success", "data": data.data})

@main_bp.route('/api/sut_girdisi_duzenle/<int:girdi_id>', methods=['PUT'])
@login_required
@lisans_kontrolu
@modification_allowed
def update_sut_girdisi(girdi_id):
    try:
        data = request.get_json()
        mevcut_girdi_res = supabase.table('sut_girdileri').select('*').eq('id', girdi_id).single().execute()
        if not mevcut_girdi_res.data or mevcut_girdi_res.data['sirket_id'] != session['user']['sirket_id']:
             return jsonify({"error": "Girdi bulunamadı veya yetkiniz yok."}), 403
        supabase.table('girdi_gecmisi').insert({
            'orijinal_girdi_id': girdi_id,
            'duzenleyen_kullanici_id': session['user']['id'],
            'duzenleme_sebebi': data['duzenleme_sebebi'],
            'eski_litre_degeri': mevcut_girdi_res.data['litre'],
            'eski_tedarikci_id': mevcut_girdi_res.data['tedarikci_id']
        }).execute()
        guncel_girdi = supabase.table('sut_girdileri').update({'litre': data['yeni_litre'],'duzenlendi_mi': True}).eq('id', girdi_id).execute()
        return jsonify({"status": "success", "data": guncel_girdi.data})
    except Exception as e:
        print(f"Düzenleme Hatası: {e}")
        return jsonify({"error": str(e)}), 500

@main_bp.route('/api/sut_girdisi_sil/<int:girdi_id>', methods=['DELETE'])
@login_required
@lisans_kontrolu
@modification_allowed
def delete_sut_girdisi(girdi_id):
    try:
        mevcut_girdi_res = supabase.table('sut_girdileri').select('sirket_id').eq('id', girdi_id).single().execute()
        if not mevcut_girdi_res.data or mevcut_girdi_res.data['sirket_id'] != session['user']['sirket_id']:
             return jsonify({"error": "Girdi bulunamadı veya silme yetkiniz yok."}), 403
        supabase.table('sut_girdileri').delete().eq('id', girdi_id).execute()
        return jsonify({"message": "Girdi başarıyla silindi."}), 200
    except Exception as e:
        print(f"Silme Hatası: {e}")
        return jsonify({"error": str(e)}), 500

# --- KULLANICI İŞLEMLERİ ---

@main_bp.route('/api/user/change_password', methods=['POST'])
@login_required
def change_password():
    try:
        data = request.get_json()
        user_response = supabase.table('kullanicilar').select('sifre').eq('id', session['user']['id']).single().execute()
        if not bcrypt.check_password_hash(user_response.data['sifre'], data.get('mevcut_sifre')):
            return jsonify({"error": "Mevcut şifreniz yanlış."}), 401
        if data.get('yeni_sifre') != data.get('yeni_sifre_tekrar'):
            return jsonify({"error": "Yeni şifreler eşleşmiyor."}), 400
        hashed_yeni_sifre = bcrypt.generate_password_hash(data.get('yeni_sifre')).decode('utf-8')
        supabase.table('kullanicilar').update({'sifre': hashed_yeni_sifre}).eq('id', session['user']['id']).execute()
        return jsonify({"message": "Şifreniz başarıyla güncellendi."})
    except Exception as e:
        print(f"Kullanıcı şifre değiştirme hatası: {e}")
        return jsonify({"error": "Şifre değiştirilirken bir hata oluştu."}), 500

@main_bp.route('/api/export_csv')
@login_required
def export_csv():
    try:
        sirket_id = session['user']['sirket_id']
        secilen_tarih_str = request.args.get('tarih')
        query = supabase.table('sut_girdileri').select('taplanma_tarihi,tedarikciler(isim),litre,kullanicilar(kullanici_adi)').eq('sirket_id', sirket_id)
        if secilen_tarih_str:
            target_date = datetime.strptime(secilen_tarih_str, '%Y-%m-%d').date()
            start_utc = turkey_tz.localize(datetime.combine(target_date, datetime.min.time())).astimezone(pytz.utc).isoformat()
            end_utc = turkey_tz.localize(datetime.combine(target_date, datetime.max.time())).astimezone(pytz.utc).isoformat()
            query = query.gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc)
        
        data = query.order('id', desc=True).execute().data
        output = io.StringIO()
        writer = csv.writer(output, delimiter=';')
        writer.writerow(['Tarih', 'Tedarikçi', 'Litre', 'Toplayan Kişi'])
        for row in data:
            formatli_tarih = datetime.fromisoformat(row['taplanma_tarihi']).astimezone(turkey_tz).strftime('%d.%m.%Y %H:%M')
            tedarikci_adi = row.get('tedarikciler', {}).get('isim', 'Bilinmiyor')
            toplayan_kisi = row.get('kullanicilar', {}).get('kullanici_adi', 'Bilinmiyor')
            writer.writerow([formatli_tarih, tedarikci_adi, str(row['litre']).replace('.',','), toplayan_kisi])
        output.seek(0)
        filename = f"{secilen_tarih_str}_sut_raporu.csv" if secilen_tarih_str else "sut_raporu.csv"
        return send_file(io.BytesIO(output.getvalue().encode('utf-8-sig')), mimetype='text/csv', as_attachment=True, download_name=filename)
    except Exception as e:
        print(f"CSV Dışa Aktarma Hatası: {e}")
        return jsonify({"error": "Rapor oluşturulurken bir hata oluştu."}), 500

####Offline modu
@main_bp.route('/offline')
def offline_page():
    return render_template('offline.html')


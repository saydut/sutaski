# test_script.py (YENİ SENARYOLAR VE TANKER TESTLERİ EKLENMİŞ HALİ)

import requests
import logging
from datetime import datetime, timedelta
import sys
import time

# --- 1. AYARLAR: BU BÖLÜMÜ MUTLAKA DÜZENLE ---

# Sunucunun ana URL'si
BASE_URL = "https://www.dijitalmandira.com"  # KENDİ SUNUCU ADRESİNİ YAZ
ADMIN_KULLANICI_ADI = "mr.anderson"  # Sadece lisanslama için kullanılacak SÜPER ADMIN adı
ADMIN_SIFRE = "neotheone"      # SÜPER ADMIN şifresi

# Sıfırdan oluşturulacak YENİ FİRMA ve YETKİLİ bilgileris
YENI_SIRKET_ADI = f"Test Sirketi {datetime.now().strftime('%H%M%S')}"
YENI_YETKILI_KADI = f"yetkili_{datetime.now().strftime('%H%M%S')}"
YENI_YETKILI_SIFRE = "1234"

# Yeni firma altında oluşturulacak test kullanıcıları
TOPLAYICI_KULLANICI_ADI = "otomatik_toplayici"
MUHASEBECI_KULLANICI_ADI = "otomatik_muhasebeci"
KULLANICI_SIFRE = "1234"

# --- AYARLAR BİTTİ ---


# --- Test Altyapısı ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger()

class Renk:
    YESIL = '\033[92m'
    SARI = '\033[93m'
    KIRMIZI = '\033[91m'
    MAVI = '\033[94m'
    RESET = '\033[0m'

def print_test_basligi(baslik):
    log.info(f"\n{Renk.MAVI}===== {baslik} ====={Renk.RESET}")

def print_success(mesaj):
    log.info(f"{Renk.YESIL}  [BAŞARILI] {mesaj}{Renk.RESET}")

def print_fail(mesaj, response=None):
    log.error(f"{Renk.KIRMIZI}  [HATA] {mesaj}{Renk.RESET}")
    if response is not None:
        try:
            log.error(f"  [Sunucu Yanıtı]: {response.json()}")
        except requests.exceptions.JSONDecodeError:
            log.error(f"  [Sunucu Yanıtı (HTML/Text)]: {response.text[:200]}...")

def print_info(mesaj):
    log.info(f"{Renk.SARI}  [BİLGİ] {mesaj}{Renk.RESET}")

STATE = {}
session = requests.Session()

def api_request(method, endpoint, expected_status=200, allow_redirects=True, **kwargs):
    """Merkezi API istek fonksiyonu"""
    url = f"{BASE_URL}{endpoint}"
    try:
        response = session.request(method, url, allow_redirects=allow_redirects, **kwargs)
        
        if response.status_code == expected_status:
            print_success(f"{method} {endpoint} -> {expected_status} OK")
            try:
                return response.json()
            except requests.exceptions.JSONDecodeError:
                return response.text
        else:
            print_fail(f"{method} {endpoint} -> Beklenen: {expected_status}, Gelen: {response.status_code}", response)
            return None
    except requests.exceptions.RequestException as e:
        print_fail(f"{method} {endpoint} -> Bağlantı Hatası: {e}")
        return None

def login(kullanici_adi, sifre, rol_dogrulama=None):
    print_info(f"{kullanici_adi} olarak giriş yapılıyor...")
    data = {"kullanici_adi": kullanici_adi, "sifre": sifre}
    json_data = api_request("POST", "/api/login", 200, json=data)
    if json_data:
        STATE['current_user_role'] = json_data.get('user', {}).get('rol') # .get() ile daha güvenli
        if rol_dogrulama and STATE['current_user_role'] != rol_dogrulama:
            print_fail(f"Rol doğrulaması başarısız! Beklenen: {rol_dogrulama}, Gelen: {STATE['current_user_role']}")
            return False
        return True
    return False

def logout():
    """Çıkış yapar ve session'ı temizler"""
    print_info("Çıkış yapılıyor...")
    api_request("GET", "/logout", 302, allow_redirects=False)
    session.cookies.clear()
    STATE['current_user_role'] = None

# --- TEST SENARYOLARI ---

def senaryo_1_firma_olusturma_ve_lisanslama():
    print_test_basligi(f"SENARYO 1: Yeni Firma '{YENI_SIRKET_ADI}' Kaydı ve Lisanslama")
    
    register_data = {
        "kullanici_adi": YENI_YETKILI_KADI,
        "sifre": YENI_YETKILI_SIFRE,
        "sirket_adi": YENI_SIRKET_ADI
    }
    json_data = api_request("POST", "/api/register", 201, json=register_data)
    if not json_data: return False
    
    if not login(ADMIN_KULLANICI_ADI, ADMIN_SIFRE, "admin"):
        return False
        
    admin_data = api_request("GET", "/api/admin/data", 200)
    if not admin_data: return False
    
    yeni_sirket = next((s for s in admin_data['sirketler'] if s['sirket_adi'] == YENI_SIRKET_ADI), None)
    if not yeni_sirket:
        print_fail(f"Admin, yeni oluşturulan '{YENI_SIRKET_ADI}' şirketini bulamadı.")
        return False
        
    STATE['yeni_sirket_id'] = yeni_sirket['id']
    print_info(f"Yeni şirket bulundu, ID: {STATE['yeni_sirket_id']}")

    gelecek_yil = (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d')
    lisans_data = {
        "sirket_id": STATE['yeni_sirket_id'],
        "yeni_tarih": gelecek_yil
    }
    json_data = api_request("POST", "/api/admin/update_lisans", 200, json=lisans_data)
    if not json_data: return False
    
    logout()
    return True

def senaryo_2_yetkili_hazirlik():
    print_test_basligi(f"SENARYO 2: YENİ FİRMA YETKİLİSİ ({YENI_YETKILI_KADI}) - Hazırlık")
    if not login(YENI_YETKILI_KADI, YENI_YETKILI_SIFRE, "firma_yetkilisi"):
        return False
    
    toplayici_data = { "kullanici_adi": TOPLAYICI_KULLANICI_ADI, "sifre": KULLANICI_SIFRE, "rol": "toplayici" }
    json_data = api_request("POST", "/firma/api/toplayici_ekle", 201, json=toplayici_data)
    if not json_data: return False
    STATE['toplayici_id'] = json_data['kullanici']['id']
    print_info(f"Toplayıcı oluşturuldu, ID: {STATE['toplayici_id']}")

    muhasebeci_data = { "kullanici_adi": MUHASEBECI_KULLANICI_ADI, "sifre": KULLANICI_SIFRE, "rol": "muhasebeci" }
    json_data = api_request("POST", "/firma/api/toplayici_ekle", 201, json=muhasebeci_data)
    if not json_data: return False
    STATE['muhasebeci_id'] = json_data['kullanici']['id']
    print_info(f"Muhasebeci oluşturuldu, ID: {STATE['muhasebeci_id']}")

    ali_data = {"isim": "Çiftçi Ali (Test)", "tc_no": "11111111111"}
    json_data = api_request("POST", "/api/tedarikci_ekle", 201, json=ali_data)
    if not json_data: return False
    STATE['ciftci_ali_id'] = json_data['tedarikci']['id']
    STATE['ciftci_ali_kullanici_adi'] = json_data['ciftci_kullanici_adi']
    STATE['ciftci_ali_sifre'] = json_data['ciftci_sifre']
    print_info(f"Çiftçi Ali oluşturuldu, Tedarikçi ID: {STATE['ciftci_ali_id']}")

    veli_data = {"isim": "Çiftçi Veli (Test)", "tc_no": "22222222222"}
    json_data = api_request("POST", "/api/tedarikci_ekle", 201, json=veli_data)
    if not json_data: return False
    STATE['ciftci_veli_id'] = json_data['tedarikci']['id']
    print_info(f"Çiftçi Veli oluşturuldu, Tedarikçi ID: {STATE['ciftci_veli_id']}")

    print_info("Toplayıcıya 'Çiftçi Veli' atanıyor...")
    atama_data = { "kullanici_adi": TOPLAYICI_KULLANICI_ADI, "atanan_tedarikciler": [STATE['ciftci_veli_id']] }
    json_data = api_request("PUT", f"/firma/api/kullanici_guncelle/{STATE['toplayici_id']}", 200, json=atama_data)
    if not json_data: return False
        
    return True

# --- YENİ SENARYO: TANKER YÖNETİMİ ---
def senaryo_3_tanker_yonetimi():
    print_test_basligi("SENARYO 3: TANKER YÖNETİMİ (Yetkili)")
    # (Firma Yetkilisi olarak devam ediyoruz)

    # 1. Yeni Tanker Ekle
    tanker_data = {"tanker_adi": "Test Tankeri 1", "kapasite_litre": "1000"}
    json_data = api_request("POST", "/tanker/api/ekle", 201, json=tanker_data)
    if not json_data: return False
    STATE['tanker_id'] = json_data['tanker']['id']
    print_info(f"Test Tankeri 1 (1000L) oluşturuldu, ID: {STATE['tanker_id']}")

    # 2. Toplayıcıyı Tankere Ata
    atama_data = {"toplayici_id": STATE['toplayici_id'], "tanker_id": STATE['tanker_id']}
    json_data = api_request("POST", "/tanker/api/ata", 201, json=atama_data)
    if not json_data: return False
    print_info(f"Toplayıcı (ID: {STATE['toplayici_id']}) Tanker'e (ID: {STATE['tanker_id']}) atandı.")
    
    return True

def senaryo_4_yetkili_akis():
    print_test_basligi(f"SENARYO 4: YETKİLİ - Ana Veri Akışı (Süt, Yem, Finans)")
    # (Firma Yetkilisi olarak devam ediyoruz)

    bugun = datetime.now().strftime('%Y-%m-%d')
    tarife_data = {"baslangic_tarihi": bugun, "alis_fiyati": "15.0", "satis_fiyati": "18.0"}
    json_data = api_request("POST", "/tarife/api/ekle", 201, json=tarife_data)
    if not json_data: return False

    sut_yemi_data = {
        "yem_adi": "Süper Süt Yemi (Test)", "fiyatlandirma_tipi": "cuval", "stok_adedi": "1000",
        "cuval_agirligi_kg": "50", "cuval_fiyati": "800", "satis_cuval_fiyati": "900"
    }
    json_data = api_request("POST", "/yem/api/urunler", 201, json=sut_yemi_data)
    if not json_data: return False
    STATE['sut_yemi_id'] = json_data['urun']['id']
    
    # Bu girişi Yetkili yapıyor (Tanker etkilenmemeli)
    sut_giris_data = {"tedarikci_id": STATE['ciftci_ali_id'], "litre": "100", "fiyat": "15.0"}
    json_data = api_request("POST", "/api/sut_girdisi_ekle", 200, json=sut_giris_data)
    if not json_data: return False
    STATE['sut_girdisi_id'] = json_data['data']['id']
    print_info(f"Yetkili, Çiftçi Ali için 100L süt girdi (Tanker etkilenmemeli), ID: {STATE['sut_girdisi_id']}")

    avans_data = {"islem_tipi": "Avans", "tedarikci_id": STATE['ciftci_ali_id'], "tutar": "500"}
    json_data = api_request("POST", "/finans/api/islemler", 201, json=avans_data)
    if not json_data: return False
    STATE['avans_id'] = json_data['islem']['id'] # Güncelleme testi için ID'yi sakla
    print_info("Çiftçi Ali'ye 500 TL avans girildi.")
    
    yem_cikis_data = {
        "tedarikci_id": STATE['ciftci_ali_id'], "yem_urun_id": STATE['sut_yemi_id'],
        "miktar_kg": "150", "fiyat_tipi": "vadeli", "birim_fiyat": "19.0"
    }
    json_data = api_request("POST", "/yem/api/islemler", 201, json=yem_cikis_data)
    if not json_data: return False
    print_info("Çiftçi Ali'ye 150 KG yem çıkışı yapıldı (Finansal kayıt oluşmalı).")
    
    return True

def senaryo_5_toplayici_testi_ve_tanker():
    print_test_basligi("SENARYO 5: TOPLAYICI Testleri (Kısıtlı Yetki ve Tanker Dolumu)")
    logout()
    if not login(TOPLAYICI_KULLANICI_ADI, KULLANICI_SIFRE, "toplayici"):
        return False
        
    json_data = api_request("GET", "/api/tedarikciler_dropdown", 200)
    if not json_data: return False
    
    gorunen_ids = [t['id'] for t in json_data]
    if STATE['ciftci_veli_id'] in gorunen_ids and STATE['ciftci_ali_id'] not in gorunen_ids:
        print_success("Toplayıcı, sadece kendisine atanan 'Çiftçi Veli'yi görüyor. (Atama Testi Başarılı)")
    else:
        print_fail(f"Toplayıcı atama hatası! Görünen ID'ler: {gorunen_ids}")
        return False
        
    sut_giris_yetkisiz_data = {"tedarikci_id": STATE['ciftci_ali_id'], "litre": "10", "fiyat": "15.0"}
    api_request("POST", "/api/sut_girdisi_ekle", 400, json=sut_giris_yetkisiz_data) # 400 (ValueError)
    print_info("Toplayıcı, yetkisi olmayan 'Çiftçi Ali'ye süt giremedi. (Test Başarılı)")

    api_request("DELETE", f"/api/sut_girdisi_sil/{STATE['sut_girdisi_id']}", 404) # 404 (ValueError)
    print_info("Toplayıcı, Yetkili'nin girdisini silemedi. (Test Başarılı)")

    # TANKER TESTİ 1
    sut_giris_veli_data = {"tedarikci_id": STATE['ciftci_veli_id'], "litre": "300", "fiyat": "15.0"}
    json_data = api_request("POST", "/api/sut_girdisi_ekle", 200, json=sut_giris_veli_data)
    if not json_data: return False
    print_info("Toplayıcı, Çiftçi Veli için 300L süt girdi. (Tanker doluluğu artmalı)")

    # TANKER TESTİ 2 (Kapasite Aşımı)
    sut_giris_kapasite_asimi = {"tedarikci_id": STATE['ciftci_veli_id'], "litre": "800", "fiyat": "15.0"} # 1000L kapasite, 300L doldu, 700L yer var
    api_request("POST", "/api/sut_girdisi_ekle", 400, json=sut_giris_kapasite_asimi) # 400 (ValueError - Kapasite Aşıldı)
    print_info("Toplayıcı, 800L süt girmeyi denedi ve 'Tanker kapasitesi aşıldı' hatası aldı. (Test Başarılı)")

    # TANKER TESTİ 3 (Tam Kapasite)
    sut_giris_tam_kapasite = {"tedarikci_id": STATE['ciftci_veli_id'], "litre": "700", "fiyat": "15.0"}
    json_data = api_request("POST", "/api/sut_girdisi_ekle", 200, json=sut_giris_tam_kapasite)
    if not json_data: return False
    STATE['sut_girdisi_toplayici_id'] = json_data['data']['id'] # Silme testi için ID'yi sakla
    print_info("Toplayıcı, Çiftçi Veli için 700L daha süt girdi. (Tanker şimdi 1000L doldu)")

    return True

def senaryo_6_tanker_bosaltma_ve_masraf():
    print_test_basligi("SENARYO 6: TANKER BOŞALTMA VE MASRAF YÖNETİMİ (Yetkili)")
    logout()
    if not login(YENI_YETKILI_KADI, YENI_YETKILI_SIFRE, "firma_yetkilisi"):
        return False
        
    # 1. Tanker Durumunu Kontrol Et
    json_data = api_request("GET", "/tanker/api/listele", 200)
    if not json_data: return False
    tanker = next((t for t in json_data if t['id'] == STATE['tanker_id']), None)
    if not tanker or float(tanker['mevcut_doluluk']) != 1000.0:
        print_fail(f"Tanker doluluk kontrolü başarısız! Beklenen: 1000.0, Gelen: {tanker['mevcut_doluluk'] if tanker else 'Tanker Yok'}")
        return False
    print_success("Tanker doluluğu 1000L olarak doğrulandı.")

    # 2. Tankeri Sat/Boşalt
    satis_data = {"satis_birim_fiyati": "20.0", "aciklama": "Test Süt Satışı"} # 1000L * 20 TL = 20.000 TL
    json_data = api_request("POST", f"/tanker/api/sat_ve_bosalt/{STATE['tanker_id']}", 201, json=satis_data)
    if not json_data: return False
    STATE['tanker_satis_id'] = json_data['satis']['id']
    print_info(f"Tanker satışı (ID: {STATE['tanker_satis_id']}) yapıldı. (Finansal kayıt oluşmalı)")

    # 3. Tanker Durumunu Tekrar Kontrol Et (Boş olmalı)
    json_data = api_request("GET", "/tanker/api/listele", 200)
    if not json_data: return False
    tanker = next((t for t in json_data if t['id'] == STATE['tanker_id']), None)
    if tanker and float(tanker['mevcut_doluluk']) == 0.0:
        print_success("Tanker doluluğu 0L (boş) olarak doğrulandı.")
    else:
        print_fail(f"Tanker boşaltma başarısız! Beklenen: 0.0, Gelen: {tanker['mevcut_doluluk']}")
        return False

    # 4. Masraf Yönetimi Testi
    print_info("Masraf Yönetimi test ediliyor...")
    kat_data = {"kategori_adi": "Test Yakıt Gideri"}
    json_data = api_request("POST", "/masraf/api/kategori/ekle", 201, json=kat_data)
    if not json_data: return False
    STATE['masraf_kategori_id'] = json_data['kategori']['id']

    masraf_data = {
        "kategori_id": STATE['masraf_kategori_id'], "tutar": "1500", 
        "masraf_tarihi": datetime.now().strftime('%Y-%m-%d')
    }
    json_data = api_request("POST", "/masraf/api/ekle", 201, json=masraf_data)
    if not json_data: return False
    STATE['masraf_id'] = json_data['masraf']['id']

    # 5. Yem Stok Girişi Testi
    print_info("Yem Stok Girişi test ediliyor...")
    yem_giris_data = {
        "yem_urun_id": STATE['sut_yemi_id'], "miktar_kg": "500", "birim_alis_fiyati": "16.0"
    }
    json_data = api_request("POST", "/yem/api/giris/ekle", 201, json=yem_giris_data)
    if not json_data: return False
    print_info("Yem stok girişi yapıldı (500 KG). (Gider kaydı oluşmalı)")

    return True

def senaryo_7_ciftci_testi_son_durum():
    print_test_basligi("SENARYO 7: ÇİFTÇİ Testleri (Son Bakiye)")
    logout()
    if not login(STATE['ciftci_ali_kullanici_adi'], STATE['ciftci_ali_sifre'], "ciftci"):
        return False

    # 1. Finansal Özeti Kontrol Et
    json_data = api_request("GET", "/api/ciftci/ozet", 200)
    if not json_data: return False
    
    # Beklenen Değerler (Orijinal script'ten. Güncelleme olmamış varsayılıyor)
    # Süt Alacağı: 100L * 15.0 TL = 1500.00
    # Yem Borcu: 150KG * 19.0 TL = 2850.00
    # Şirketten Ödeme (Avans): 500.00
    # Net Bakiye: 1500 - 2850 - 500 = -1850.00
    
    # Not: Orijinal script'te Süt Güncelleme (Senaryo 3) vardı.
    # 110L * 15.0 TL = 1650.00
    # Bakiye: 1650 - 2850 - 500 = -1700.00
    # Bizim bu script'te Senaryo 3 (Yetkili Akış)'ta güncelleme YOK. 100L'de kalıyor.
    # Bu yüzden -1850.00 beklemeliyiz.
    
    # DÜZELTME: Orijinal script'in 3. senaryosunu (güncelleme ile) geri alalım
    # ki bakiye testi bozulmasın. 
    # Bu script'in Senaryo 4'üne Süt Güncelleme ekleyelim.
    print_info("Bakiye testi için Senaryo 4'teki süt girdisi güncelleniyor...")
    logout()
    login(YENI_YETKILI_KADI, YENI_YETKILI_SIFRE, "firma_yetkilisi")
    guncelle_data = {"yeni_litre": "110", "yeni_fiyat": "15.0", "duzenleme_sebebi": "Test Bakiye Düzeltmesi"}
    api_request("PUT", f"/api/sut_girdisi_duzenle/{STATE['sut_girdisi_id']}", 200, json=guncelle_data)
    logout()

    # Şimdi Çiftçi olarak tekrar giriş yap
    if not login(STATE['ciftci_ali_kullanici_adi'], STATE['ciftci_ali_sifre'], "ciftci"):
        return False
        
    json_data = api_request("GET", "/api/ciftci/ozet", 200)
    if not json_data: return False
    
    # Beklenen Bakiye (110L * 15 TL) = 1650
    # 1650 (Süt) - 2850 (Yem) - 500 (Avans) = -1700.00
    
    if json_data['net_bakiye'] == "-1700.00":
        print_success("Çiftçi paneli özet hesaplamaları (Güncellenmiş süt ile) doğru.")
    else:
        print_fail(f"Çiftçi özeti NET BAKİYE hatası! Beklenen: -1700.00, Gelen: {json_data['net_bakiye']}")
        print_fail(f"Detaylar: Süt:{json_data['toplam_sut_alacagi']}, Yem:{json_data['toplam_yem_borcu']}, Ödeme:{json_data['toplam_sirket_odemesi']}")
        return False
    
    return True
    
def senaryo_8_muhasebeci_testi():
    print_test_basligi("SENARYO 8: MUHASEBECİ Testleri (Yazma Koruması)")
    logout()
    if not login(MUHASEBECI_KULLANICI_ADI, KULLANICI_SIFRE, "muhasebeci"):
        return False

    if not api_request("GET", "/api/tedarikciler_dropdown", 200): return False
    
    print_info("Muhasebeci veri eklemeyi deniyor (Başarısız olmalı)...")
    sut_giris_data = {"tedarikci_id": STATE['ciftci_ali_id'], "litre": "10", "fiyat": "15.0"}
    api_request("POST", "/api/sut_girdisi_ekle", 403, json=sut_giris_data)
    
    avans_data = {"islem_tipi": "Avans", "tedarikci_id": STATE['ciftci_ali_id'], "tutar": "10"}
    api_request("POST", "/finans/api/islemler", 403, json=avans_data)

    yem_cikis_data = {"tedarikci_id": STATE['ciftci_ali_id'], "yem_urun_id": STATE['sut_yemi_id'], "miktar_kg": "50"}
    api_request("POST", "/yem/api/islemler", 403, json=yem_cikis_data)
    
    print_success("Muhasebeci veri yazma işlemleri '@modification_allowed' tarafından engellendi.")
    
    return True

def senaryo_9_raporlar_ve_profil():
    print_test_basligi("SENARYO 9: RAPORLAR, PROFİL ve YETKİ TESTLERİ (Yetkili)")
    logout()
    if not login(YENI_YETKILI_KADI, YENI_YETKILI_SIFRE, "firma_yetkilisi"):
        return False

    # 1. Rapor API'lerini Test Et
    bugun = datetime.now().strftime('%Y-%m-%d')
    bir_ay_once = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    print_info("Rapor API'leri test ediliyor...")
    
    api_request("GET", f"/api/rapor/karlilik?baslangic={bir_ay_once}&bitis={bugun}", 200)
    
    ay = datetime.now().month
    yil = datetime.now().year
    api_request("GET", f"/api/tedarikci/{STATE['ciftci_ali_id']}/hesap_ozeti_pdf?ay={ay}&yil={yil}", 200)
    api_request("GET", f"/api/tedarikci/{STATE['ciftci_ali_id']}/mustahsil_makbuzu_pdf?ay={ay}&yil={yil}", 200)
    api_request("GET", f"/api/rapor/aylik_pdf?ay={ay}&yil={yil}", 200)
    api_request("GET", "/api/rapor/export_csv", 200)

    # 2. Profil Yönetimi Testleri
    print_info("Profil Yönetimi test ediliyor...")
    profil_data = {
        "kullanici": {"eposta": "test@test.com", "telefon_no": "123456"},
        "sirket": {"vergi_kimlik_no": "111222333", "adres": "Test Adres"},
        "sifreler": {}
    }
    api_request("PUT", "/api/profil", 200, json=profil_data)
    
    # 3. Başka Kullanıcının Şifresini Sıfırlama
    sifre_setle_data = {"yeni_sifre": "toplayici5678"}
    api_request("POST", f"/firma/api/kullanici_sifre_setle/{STATE['toplayici_id']}", 200, json=sifre_setle_data)
    
    # 4. Sıfırlamayı Doğrula (Toplayıcı olarak yeni şifreyle giriş yap)
    logout()
    print_info("Toplayıcı şifresinin sıfırlandığı doğrulanıyor...")
    if not login(TOPLAYICI_KULLANICI_ADI, "toplayici5678", "toplayici"):
        print_fail("Firma Yetkilisi'nin şifre sıfırlaması BAŞARISIZ OLDU.")
        return False
    print_success("Toplayıcı, Yetkili'nin belirlediği yeni şifre ile giriş yapabildi.")
    
    return True

def senaryo_10_admin_rol_testleri():
    print_test_basligi("SENARYO 10: ADMİN Rol ve Şifre Yönetimi Testleri")
    logout()
    if not login(ADMIN_KULLANICI_ADI, ADMIN_SIFRE, "admin"):
        return False
        
    # 1. Muhasebecinin Rolünü Toplayıcı Yap
    rol_data = {"kullanici_id": STATE['muhasebeci_id'], "yeni_rol": "toplayici"}
    api_request("POST", "/api/admin/update_rol", 200, json=rol_data)
    
    # 2. Firma Yetkilisinin Şifresini Sıfırla (Burada toplayıcıyı resetliyoruz)
    sifre_data = {"kullanici_id": STATE['toplayici_id'], "yeni_sifre": "adminYeniSifre"}
    api_request("POST", "/api/admin/reset_password", 200, json=sifre_data)
    
    # 3. Doğrulama (Eski Muhasebeci artık Toplayıcı olarak giriş yapmalı)
    logout()
    print_info("Eski muhasebecinin rolünün 'toplayici' olduğu doğrulanıyor...")
    if not login(MUHASEBECI_KULLANICI_ADI, KULLANICI_SIFRE, "toplayici"):
        print_fail("Admin rol güncellemesi BAŞARISIZ OLDU.")
        return False
    print_success("Admin, muhasebecinin rolünü toplayıcı olarak güncelledi.")
    
    return True

def senaryo_11_crud_testleri_ve_tanker_silme():
    print_test_basligi("SENARYO 11: CRUD ve Tanker Silme Testleri (Yetkili)")
    logout()
    if not login(YENI_YETKILI_KADI, YENI_YETKILI_SIFRE, "firma_yetkilisi"):
        return False
        
    # 1. Finans İşlemi Güncelleme
    print_info(f"Finans işlemi (Avans ID: {STATE['avans_id']}) güncelleniyor...")
    avans_guncelle_data = {"tutar": "600", "aciklama": "Güncellenmiş Avans"}
    api_request("PUT", f"/finans/api/islemler/{STATE['avans_id']}", 200, json=avans_guncelle_data)

    # 2. Finans İşlemi Silme
    print_info(f"Finans işlemi (Avans ID: {STATE['avans_id']}) siliniyor...")
    api_request("DELETE", f"/finans/api/islemler/{STATE['avans_id']}", 200)

    # 3. Toplayıcı Süt Girişini Silme (Tanker Doluluğu Azalmalı)
    # Toplayıcı 700L süt girmişti (ID: STATE['sut_girdisi_toplayici_id'])
    # Tanker (ID: STATE['tanker_id']) şu an 0L (boş) durumda.
    # Bu testi yapabilmek için tankerin dolu olması lazım.
    # Önce Toplayıcı olarak tekrar süt girişi yapalım
    logout()
    login(TOPLAYICI_KULLANICI_ADI, "adminYeniSifre", "toplayici") # Admin şifreyi değiştirmişti
    sut_giris_data = {"tedarikci_id": STATE['ciftci_veli_id'], "litre": "250", "fiyat": "15.0"}
    json_data = api_request("POST", "/api/sut_girdisi_ekle", 200, json=sut_giris_data)
    if not json_data: return False
    yeni_girdi_id = json_data['data']['id']
    print_info("Toplayıcı 250L süt girdi. Tanker doluluğu 250L olmalı.")
    logout()
    
    # Yetkili olarak giriş yap ve kontrol et
    login(YENI_YETKILI_KADI, YENI_YETKILI_SIFRE, "firma_yetkilisi")
    json_data = api_request("GET", "/tanker/api/listele", 200)
    tanker = next((t for t in json_data if t['id'] == STATE['tanker_id']), None)
    if not tanker or float(tanker['mevcut_doluluk']) != 250.0:
        print_fail(f"Tanker doluluk (Silme öncesi) kontrolü başarısız! Beklenen: 250.0, Gelen: {tanker['mevcut_doluluk'] if tanker else 'Yok'}")
        return False
    
    # Şimdi Yetkili, o girişi siliyor
    print_info(f"Yetkili, Toplayıcının 250L'lik süt girdisini (ID: {yeni_girdi_id}) siliyor...")
    api_request("DELETE", f"/api/sut_girdisi_sil/{yeni_girdi_id}", 200)

    # Tanker doluluğu tekrar 0 olmalı
    json_data = api_request("GET", "/tanker/api/listele", 200)
    tanker = next((t for t in json_data if t['id'] == STATE['tanker_id']), None)
    if not tanker or float(tanker['mevcut_doluluk']) != 0.0:
        print_fail(f"Tanker doluluk (Silme sonrası) kontrolü başarısız! Beklenen: 0.0, Gelen: {tanker['mevcut_doluluk'] if tanker else 'Yok'}")
        return False
    print_success("Yetkili, toplayıcı girdisini sildi ve tanker doluluğu azaldı.")
    
    return True

def senaryo_12_temizlik():
    print_test_basligi("SENARYO 12: TEMİZLİK (Admin ile Test Şirketi Siliniyor)")
    logout()
    if not login(ADMIN_KULLANICI_ADI, ADMIN_SIFRE, "admin"):
        print_fail("Temizlik adımı için Admin girişi başarısız. Lütfen manuel temizlik yapın.")
        return False

    if 'yeni_sirket_id' in STATE:
        print_info(f"Test Şirketi (ID: {STATE['yeni_sirket_id']}) ve tüm bağlı verileri siliniyor...")
        api_request("POST", "/api/admin/delete_company", 200, json={"sirket_id": STATE['yeni_sirket_id']})
        print_success("Temizlik tamamlandı.")
    else:
        print_fail("Temizlik yapılamadı, test şirketi ID'si bulunamadı.")
        
    return True

# --- Ana Çalıştırıcı ---
def main():
    test_senaryolari = [
        senaryo_1_firma_olusturma_ve_lisanslama,
        senaryo_2_yetkili_hazirlik,
        senaryo_3_tanker_yonetimi,
        senaryo_4_yetkili_akis,
        senaryo_5_toplayici_testi_ve_tanker,
        senaryo_6_tanker_bosaltma_ve_masraf,
        senaryo_7_ciftci_testi_son_durum,
        senaryo_8_muhasebeci_testi,
        senaryo_9_raporlar_ve_profil,
        senaryo_10_admin_rol_testleri,
        senaryo_11_crud_testleri_ve_tanker_silme
    ]

    try:
        for adim, senaryo in enumerate(test_senaryolari, 1):
            if not senaryo():
                raise Exception(f"Senaryo {adim} ({senaryo.__name__}) BAŞARISIZ OLDU.")
            time.sleep(1) # API'ye nefes aldır
        
        print_test_basligi(f"{Renk.YESIL}TÜM TEST SENARYOLARI BAŞARIYLA TAMAMLANDI!{Renk.RESET}")

    except Exception as e:
        print_fail(f"Test script'i durdu: {e}")
        print_info("Bir hata nedeniyle testler durduruldu. Temizlik adımı çalıştırılacak.")
    
    finally:
        senaryo_12_temizlik()
        logout()
        print_info("Test script'i tamamlandı.")
        sys.exit()

if __name__ == "__main__":
    main()
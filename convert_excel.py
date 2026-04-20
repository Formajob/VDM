import pandas as pd
import re
from datetime import datetime

# Mapping des noms vers IDs
REDacteur_IDS = {
    'Outhman BOUDARRAJA': 'user001',
    'ASMAA': 'user002',
    'KARIM': 'user008',
    'Soukaina HAJJAMI': 'user007',
    'Loubna BENKADDOUSS': 'user006'
}

TECHSON_IDS = {
    'Driss BAKKARI': 'user003',
    'Hassan LABHAR': 'user011',
    'Hassnaa TALAI': 'user010'
}

def extract_materialRef(name):
    """Extrait le materialRef du nom du projet"""
    if not name or pd.isna(name):
        return None
    name_str = str(name)
    pattern = r'[_-]([mgeit]\d+[a]?)_\d{4}-\d{1,2}-\d{1,2}'
    match = re.search(pattern, name_str)
    if match:
        return match.group(1)
    pattern2 = r'[_-]([mgeit]\d+[a]?)'
    match = re.search(pattern2, name_str)
    if match:
        return match.group(1)
    return None

def extract_season_episode(name):
    """Extrait la saison et le numéro d'épisode du nom du projet"""
    if not name or pd.isna(name):
        return None, None
    
    name_str = str(name)
    
    # Pattern 1: titre-saison_episode-materialRef
    pattern1 = r'^[a-zA-Z0-9]+-(\d+)_(\d+)-[a-zA-Z0-9]+'
    match1 = re.search(pattern1, name_str)
    if match1:
        return match1.group(1), match1.group(2)
    
    # Pattern 2: titre-saison_episodenum-materialRef
    pattern2 = r'^[a-zA-Z0-9]+-(\d+)_(\d+)-g\d+'
    match2 = re.search(pattern2, name_str)
    if match2:
        return match2.group(1), match2.group(2)
    
    # Pattern 3: titre-saison episodenum
    pattern3 = r'^[a-zA-Z0-9]+-(\d+)_(\d+[a-zA-Z0-9]*)-'
    match3 = re.search(pattern3, name_str)
    if match3:
        return match3.group(1), match3.group(2)
    
    return None, None

def determine_projectType(name, excel_type):
    """Détermine le type de projet"""
    if not name or pd.isna(name):
        return 'SERIE_EMISSION'
    name_str = str(name).lower()
    if excel_type and 'FILM' in str(excel_type).upper():
        return 'FILM'
    film_pattern = r'-0_[mgei]\d+[a]?'
    serie_pattern = r'-\d+_\d+-[mgei]\d+[a]?'
    if re.search(film_pattern, name_str):
        return 'FILM'
    elif re.search(serie_pattern, name_str):
        return 'SERIE_EMISSION'
    else:
        return 'SERIE_EMISSION'

def parse_date(date_value):
    """Convertit une date Excel en format YYYY-MM-DD"""
    if pd.isna(date_value) or date_value == '' or date_value is None:
        return None
    try:
        if isinstance(date_value, pd.Timestamp):
            if date_value.year < 1900:
                return None
            return date_value.strftime('%Y-%m-%d')
        date_str = str(date_value).strip()
        if date_str == '00/01/1900' or date_str == '' or date_str == 'NaT':
            return None
        for fmt in ['%m/%d/%y', '%Y-%m-%d', '%d/%m/%Y']:
            try:
                parsed = datetime.strptime(date_str, fmt)
                if parsed.year < 2000:
                    parsed = parsed.replace(year=parsed.year + 100)
                return parsed.strftime('%Y-%m-%d')
            except:
                continue
        return None
    except:
        return None

def normalize_status(status_value):
    """Normalise les statuts"""
    if pd.isna(status_value) or status_value == '' or status_value is None:
        return 'PAS_ENCORE'
    status_str = str(status_value).upper().strip()
    if 'FAIT' in status_str or 'FAI' in status_str:
        return 'FAIT'
    elif 'EN_COURS' in status_str or 'EN COURS' in status_str:
        return 'EN_COURS'
    elif 'PAS_ENCORE' in status_str or 'PAS ENCORE' in status_str:
        return 'PAS_ENCORE'
    elif 'SIGNALE' in status_str:
        return 'SIGNALE'
    else:
        return 'PAS_ENCORE'

def convert_to_int(value):
    """Convertit en integer"""
    if pd.isna(value) or value == '' or value is None:
        return None
    try:
        return int(float(value))
    except:
        return None

def convert_to_float(value):
    """Convertit en float"""
    if pd.isna(value) or value == '' or value is None:
        return None
    try:
        return round(float(value), 2)
    except:
        return None

def get_workflowStep(row):
    """
    Détermine le workflowStep basé sur l'assignation et les statuts
    ✅ RÈGLES CORRECTES:
    - DISPATCH: Pas de redacteurId
    - REDACTION: redacteurId ≠ NULL ET status = "PAS_ENCORE"
    - STUDIO: status = "FAIT" ET mixStatus ≠ "FAIT"
    - LIVRAISON: mixStatus = "FAIT"
    """
    redacteurId = row.get('redacteurId', None)
    status = normalize_status(row.get('statut redaction', ''))
    mixStatus = normalize_status(row.get('STATUT mixage', ''))
    
    # ✅ 1. DISPATCH: Pas encore assigné à un rédacteur (redacteurId = NULL)
    if pd.isna(redacteurId) or redacteurId is None or redacteurId == '':
        return 'DISPATCH'
    
    # ✅ 2. REDACTION: Assigné (redacteurId ≠ NULL) ET rédaction pas encore faite
    if status == 'PAS_ENCORE':
        return 'REDACTION'
    
    # ✅ 3. STUDIO: Rédaction faite (status = "FAIT") ET mixage pas fait
    if status == 'FAIT' and mixStatus != 'FAIT':
        return 'STUDIO'
    
    # ✅ 4. LIVRAISON: Mixage fait (mixStatus = "FAIT")
    if mixStatus == 'FAIT':
        return 'LIVRAISON'
    
    # Par défaut
    return 'REDACTION'

# Lire le fichier Excel
print("📖 Lecture du fichier Excel...")
df = pd.read_excel('Nouveau Feuille de calcul Microsoft Excel.xlsx')
print(f"📊 Total lignes: {len(df)}")

# Afficher les colonnes trouvées
print("\n📋 Colonnes trouvées:")
print(list(df.columns))

# Nettoyer les noms de colonnes (enlever espaces)
df.columns = df.columns.str.strip()

# Créer le DataFrame final
print("🔄 Conversion des données...")
final_df = pd.DataFrame()

# Name (Nom du Projet)
final_df['name'] = df['Nom du Projet']

# MaterialRef (extrait du nom)
final_df['materialRef'] = df['Nom du Projet'].apply(extract_materialRef)

# SeriesName (extrait du nom - premier mot avant -)
def extract_seriesName(name):
    if not name or pd.isna(name):
        return ''
    name_str = str(name)
    match = re.match(r'^([a-zA-Z0-9]+)-', name_str)
    if match:
        return match.group(1)
    return name_str[:50]

final_df['seriesName'] = df['Nom du Projet'].apply(extract_seriesName)

# Extraire season et episodeNumber
print("🔄 Extraction saison et épisode...")
final_df['season'], final_df['episodeNumber'] = zip(*df['Nom du Projet'].apply(extract_season_episode))

# ProjectType
final_df['projectType'] = df.apply(lambda row: determine_projectType(row['Nom du Projet'], row.get('TYPE', None)), axis=1)

# Dates
final_df['startDate'] = df['date de reception'].apply(parse_date)
final_df['deadline'] = df['date d\'echeance'].apply(parse_date)
final_df['writtenAt'] = df['Date de rédaction'].apply(parse_date)
final_df['mixedAt'] = df['Date de narration et /mixage.'].apply(parse_date)
final_df['deliveredAt'] = df['Date de livraison'].apply(parse_date)

# Statuts
final_df['mixStatus'] = df['STATUT mixage'].apply(normalize_status)
final_df['status'] = df['statut redaction'].apply(normalize_status)
final_df['deliveryStatus'] = df['livraison'].apply(normalize_status)

# vsStatus = "AI" si Narration/VS = "AI", sinon vide
final_df['vsStatus'] = df['Narration/VS'].apply(
    lambda x: 'AI' if pd.notna(x) and str(x).upper().strip() == 'AI' else ''
)

# Nombres
final_df['pageCount'] = df['Nbr de pages'].apply(convert_to_int)
final_df['durationMin'] = df['Durée minutes'].apply(convert_to_float)

# IDs utilisateurs
final_df['redacteurId'] = df['redacteur'].map(REDacteur_IDS)
final_df['techSonId'] = df['tech son'].map(TECHSON_IDS)

# BroadcastChannel
final_df['broadcastChannel'] = df['CHAINE']

# Champs booléens
print("🔄 Calcul des champs booléens...")

# isMixed = true si STATUT mixage = "FAIT"
final_df['isMixed'] = df['STATUT mixage'].apply(
    lambda x: True if pd.notna(x) and str(x).upper().strip() in ['FAIT', 'FAI'] else False
)

# isWritten = true si statut redaction = "FAIT"
final_df['isWritten'] = df['statut redaction'].apply(
    lambda x: True if pd.notna(x) and str(x).upper().strip() in ['FAIT', 'FAI'] else False
)

# isDelivered = true SI deliveryStatus = "FAIT" OU deliveredAt n'est pas NULL
final_df['isDelivered'] = df.apply(
    lambda row: True if (
        (pd.notna(row['livraison']) and str(row['livraison']).upper().strip() in ['FAIT', 'FAI']) or
        pd.notna(row['Date de livraison'])
    ) else False,
    axis=1
)

# isNarrated = true si Narration/VS = "AI" (non vide)
final_df['isNarrated'] = df['Narration/VS'].apply(
    lambda x: True if pd.notna(x) and str(x).upper().strip() == 'AI' else False
)

# isAINarrator = true si Narration/VS = "AI" (non vide)
final_df['isAINarrator'] = df['Narration/VS'].apply(
    lambda x: True if pd.notna(x) and str(x).upper().strip() == 'AI' else False
)

# ✅ workflowStep avec la bonne logique
print("🔄 Calcul du workflowStep...")
final_df['workflowStep'] = df.apply(
    lambda row: get_workflowStep(row),
    axis=1
)

# Champs fixes
final_df['language'] = 'fr'
final_df['totalEpisodes'] = 0

# Sauvegarder en CSV
final_df.to_csv('projects_import.csv', index=False, sep=',', encoding='utf-8-sig')

print("\n✅ Fichier CSV généré avec succès !")
print(f"📊 Total projets: {len(final_df)}")
print(f"🎬 FILM: {len(final_df[final_df['projectType'] == 'FILM'])}")
print(f"📺 SERIE_EMISSION: {len(final_df[final_df['projectType'] == 'SERIE_EMISSION'])}")
print(f"👥 Rédacteurs uniques: {final_df['redacteurId'].nunique()}")
print(f"🎧 Tech Sons uniques: {final_df['techSonId'].nunique()}")

# Vérifications du workflowStep
print("\n📊 Vérification du workflowStep:")
print(f"  DISPATCH: {(final_df['workflowStep'] == 'DISPATCH').sum()}")
print(f"  REDACTION: {(final_df['workflowStep'] == 'REDACTION').sum()}")
print(f"  STUDIO: {(final_df['workflowStep'] == 'STUDIO').sum()}")
print(f"  LIVRAISON: {(final_df['workflowStep'] == 'LIVRAISON').sum()}")

# Afficher un aperçu
print("\n📋 Aperçu des 10 premières lignes:")
print(final_df[['name', 'redacteurId', 'status', 'mixStatus', 'workflowStep']].head(10).to_string())

print(f"\n📁 Fichier créé: projects_import.csv")
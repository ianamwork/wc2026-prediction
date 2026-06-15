export const FLAGS = {
  'France': '🇫🇷', 'Spain': '🇪🇸', 'Germany': '🇩🇪', 'Argentina': '🇦🇷',
  'Belgium': '🇧🇪', 'Brazil': '🇧🇷', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Norway': '🇳🇴',
  'Netherlands': '🇳🇱', 'Switzerland': '🇨🇭', 'Colombia': '🇨🇴', 'Turkey': '🇹🇷',
  'Türkiye': '🇹🇷', 'Portugal': '🇵🇹', 'Austria': '🇦🇹', 'Croatia': '🇭🇷',
  'Morocco': '🇲🇦', 'Ecuador': '🇪🇨', 'Japan': '🇯🇵', 'Uruguay': '🇺🇾',
  'Mexico': '🇲🇽', 'Senegal': '🇸🇳', 'Canada': '🇨🇦', 'South Korea': '🇰🇷',
  'Iran': '🇮🇷', 'Czech Republic': '🇨🇿', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Paraguay': '🇵🇾',
  'Algeria': '🇩🇿', 'United States': '🇺🇸', 'Australia': '🇦🇺', 'Ivory Coast': '🇨🇮',
  'Panama': '🇵🇦', 'Uzbekistan': '🇺🇿', 'Tunisia': '🇹🇳',
  'Bosnia and Herzegovina': '🇧🇦', 'Egypt': '🇪🇬', 'Sweden': '🇸🇪',
  'Jordan': '🇯🇴', 'Iraq': '🇮🇶', 'Haiti': '🇭🇹', 'DR Congo': '🇨🇩',
  'Saudi Arabia': '🇸🇦', 'Cape Verde': '🇨🇻', 'Qatar': '🇶🇦',
  'South Africa': '🇿🇦', 'Ghana': '🇬🇭', 'New Zealand': '🇳🇿', 'Curaçao': '🇨🇼',
};

const ALIASES = {
  'turkiye': 'Turkey', 'turkey': 'Turkey',
  'usa': 'United States', 'united states': 'United States', 'us': 'United States',
  'south korea': 'South Korea', 'korea republic': 'South Korea', 'kr': 'South Korea',
  "ivory coast": 'Ivory Coast', "cote d'ivoire": 'Ivory Coast', 'civ': 'Ivory Coast',
  'bosnia': 'Bosnia and Herzegovina', 'bih': 'Bosnia and Herzegovina',
  'dr congo': 'DR Congo', 'congo dr': 'DR Congo', 'cdr': 'DR Congo', 'drc': 'DR Congo',
  'cape verde': 'Cape Verde', 'cabo verde': 'Cape Verde',
  'curacao': 'Curaçao', 'kor': 'Curaçao',
  'netherlands': 'Netherlands', 'holland': 'Netherlands',
  'new zealand': 'New Zealand', 'nzl': 'New Zealand',
  'czech republic': 'Czech Republic', 'czechia': 'Czech Republic',
};

export const normalizeTeam = (name) => {
  if (!name) return name;
  const lower = name.toLowerCase().trim();
  return ALIASES[lower] || name;
};

export const getFlag = (team) => FLAGS[team] || FLAGS[normalizeTeam(team)] || '🏳️';

/*
 * Offline Hindu panchang engine. No network, no tables of dates: everything is computed from the
 * positions of the Sun and Moon (Meeus, "Astronomical Algorithms"), so any year works.
 *   - tithi, paksha, nakshatra, yoga, karana (sidereal, Lahiri ayanamsa)
 *   - sunrise / sunset for a location, Rahu Kaal, Abhijit Muhurta
 *   - lunar month (amanta / purnimanta, adhika detection), Vikram Samvat
 *   - festivals and vrats from (month, tithi) rules, sankrantis, fixed public holidays
 * Tithi for a day is the tithi prevailing at local sunrise (udaya tithi), the usual panchang rule.
 * Accuracy: Sun/Moon to ~0.01 deg, so tithi change times are good to a few minutes.
 */
(function (root) {
  'use strict';
  const D2R = Math.PI / 180, R2D = 180 / Math.PI, HOUR = 3600000, DAY = 86400000;
  const mod = (a, n) => ((a % n) + n) % n;
  const wrapHalf = (a, p) => { a = mod(a, p); return a > p / 2 ? a - p : a; };
  const sin = x => Math.sin(x * D2R), cos = x => Math.cos(x * D2R);
  const jdOf = ms => ms / DAY + 2440587.5;

  /* ------------------------------------------------------------ astronomy */
  function sunLon(jd) {
    const T = (jd - 2451545) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
    const om = 125.04 - 1934.136 * T;
    return mod(L0 + C - 0.00569 - 0.00478 * sin(om), 360);
  }
  // Meeus table 47.A (longitude terms): [D, M, M', F, coefficient in 1e-6 deg]
  const MOON = [
    [0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],
    [2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],
    [0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],[0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],
    [4,0,-2,0,8548],[2,1,-1,0,-7888],[2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],[2,-1,1,0,4036],
    [2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],[2,0,-1,2,-2602],[2,-1,-2,0,2390],
    [1,0,1,0,-2348],[2,-2,0,0,2236],[0,1,2,0,-2120],[0,2,0,0,-2069],[2,-2,-1,0,2048],[2,0,1,-2,-1773],
    [2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110],[3,0,-1,0,-892],[2,1,1,0,-810],[4,-1,-2,0,759],
    [0,2,-1,0,-713],[2,2,-1,0,-700],[2,1,-2,0,691],[2,-1,0,-2,596],[4,0,1,0,549],[0,0,4,0,537],
    [4,-1,0,0,520],[1,0,-2,0,-487],[2,1,0,-2,-399],[0,0,2,-2,-381],[1,1,1,0,351],[3,0,-2,0,-340],
    [4,0,-3,0,330],[2,-1,2,0,327],[0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294]
  ];
  function moonLon(jd) {
    const T = (jd - 2451545) / 36525, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
    const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
    const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
    const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
    const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;
    const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.290 * T;
    const E = 1 - 0.002516 * T - 0.0000074 * T2;
    let s = 0;
    for (const [d, m, mp, f, c] of MOON) {
      const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
      s += c * e * sin(d * D + m * M + mp * Mp + f * F);
    }
    s += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
    const om = 125.04 - 1934.136 * T;
    return mod(Lp + s / 1e6 - 0.00478 * sin(om), 360);
  }
  const ayanamsa = jd => 23.85306 + (jd - 2451545) / 365.25 * 0.0139697; // Lahiri

  const elongAt = ms => { const jd = jdOf(ms); return mod(moonLon(jd) - sunLon(jd), 360); };
  const sunSidAt = ms => { const jd = jdOf(ms); return mod(sunLon(jd) - ayanamsa(jd), 360); };
  const moonSidAt = ms => { const jd = jdOf(ms); return mod(moonLon(jd) - ayanamsa(jd), 360); };
  const yogaAt = ms => mod(sunSidAt(ms) + moonSidAt(ms), 360);

  /** First time >= startMs (within spanMs) when the increasing angle f(ms) reaches target (mod 360). */
  function crossing(f, startMs, spanMs, target) {
    const g = ms => wrapHalf(f(ms) - target, 360);
    let lo = startMs, hi = startMs + spanMs;
    for (let i = 0; i < 34; i++) { const mid = (lo + hi) / 2; if (g(mid) < 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  function atInstant(ms) {
    const el = elongAt(ms), sS = sunSidAt(ms), mS = moonSidAt(ms);
    return {
      el, tithi: Math.floor(el / 12) + 1, kar: Math.floor(el / 6),
      nak: Math.floor(mS / (360 / 27)) + 1, yoga: Math.floor(mod(sS + mS, 360) / (360 / 27)) + 1, sunSid: sS, moonSid: mS
    };
  }

  /* ------------------------------------------------------------ sunrise / sunset (NOAA) */
  function sunEvent(y, m, d, lat, lon, rise) {
    const day0 = Date.UTC(y, m - 1, d);
    let minutes = 720 - 4 * lon;
    for (let i = 0; i < 3; i++) {
      const jd = jdOf(day0) + minutes / 1440, T = (jd - 2451545) / 36525;
      const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
      const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
      const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
      const C = sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + sin(2 * M) * (0.019993 - 0.000101 * T) + sin(3 * M) * 0.000289;
      const om = 125.04 - 1934.136 * T;
      const lam = L0 + C - 0.00569 - 0.00478 * sin(om);
      const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * cos(om);
      const decl = Math.asin(sin(eps) * sin(lam)) * R2D;
      const y2 = Math.tan(eps * D2R / 2) ** 2;
      const eq = 4 * R2D * (y2 * sin(2 * L0) - 2 * e * sin(M) + 4 * e * y2 * sin(M) * cos(2 * L0) - 0.5 * y2 * y2 * sin(4 * L0) - 1.25 * e * e * sin(2 * M));
      const c = (cos(90.833) / (cos(lat) * cos(decl))) - Math.tan(lat * D2R) * Math.tan(decl * D2R);
      const ha = Math.acos(Math.max(-1, Math.min(1, c))) * R2D;
      minutes = 720 - 4 * (lon + (rise ? ha : -ha)) - eq;
    }
    return day0 + minutes * 60000;
  }

  /* ------------------------------------------------------------ lunar months */
  const monthCache = new Map();
  function newMoonNear(guessMs) {
    let span = 60 * HOUR;
    for (let k = 0; k < 6; k++, span *= 1.6) {
      const g = ms => wrapHalf(elongAt(ms), 360);
      if (g(guessMs - span) < 0 && g(guessMs + span) >= 0) return crossing(elongAt, guessMs - span, 2 * span, 0);
    }
    return crossing(elongAt, guessMs - 4 * DAY, 8 * DAY, 0);
  }
  /** Amanta lunar month containing instant ms: {idx 0=Chaitra.., adhika, start, end}. */
  function lunarMonthAt(ms) {
    const e = elongAt(ms);
    const start = newMoonNear(ms - (e / 12.19) * DAY);
    const key = Math.round(start / HOUR);
    let r = monthCache.get(key);
    if (!r) {
      const end = newMoonNear(start + 29.53 * DAY);
      const s0 = Math.floor(sunSidAt(start) / 30), s1 = Math.floor(sunSidAt(end) / 30);
      r = { idx: (s0 + 1) % 12, adhika: s0 === s1, start, end };
      monthCache.set(key, r);
    }
    return r;
  }

  /* ------------------------------------------------------------ names */
  const N = {
    tithi: ['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi'],
    tithiHi: ['प्रतिपदा','द्वितीया','तृतीया','चतुर्थी','पंचमी','षष्ठी','सप्तमी','अष्टमी','नवमी','दशमी','एकादशी','द्वादशी','त्रयोदशी','चतुर्दशी'],
    nak: ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'],
    nakHi: ['अश्विनी','भरणी','कृत्तिका','रोहिणी','मृगशिरा','आर्द्रा','पुनर्वसु','पुष्य','आश्लेषा','मघा','पूर्वा फाल्गुनी','उत्तरा फाल्गुनी','हस्त','चित्रा','स्वाति','विशाखा','अनुराधा','ज्येष्ठा','मूल','पूर्वाषाढ़ा','उत्तराषाढ़ा','श्रवण','धनिष्ठा','शतभिषा','पूर्वभाद्रपद','उत्तरभाद्रपद','रेवती'],
    yoga: ['Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarma','Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra','Siddhi','Vyatipata','Variyana','Parigha','Shiva','Siddha','Sadhya','Shubha','Shukla','Brahma','Indra','Vaidhriti'],
    yogaHi: ['विष्कम्भ','प्रीति','आयुष्मान','सौभाग्य','शोभन','अतिगण्ड','सुकर्मा','धृति','शूल','गण्ड','वृद्धि','ध्रुव','व्याघात','हर्षण','वज्र','सिद्धि','व्यतीपात','वरीयान','परिघ','शिव','सिद्ध','साध्य','शुभ','शुक्ल','ब्रह्म','इन्द्र','वैधृति'],
    kar: ['Bava','Balava','Kaulava','Taitila','Gara','Vanija','Vishti (Bhadra)'],
    karHi: ['बव','बालव','कौलव','तैतिल','गर','वणिज','विष्टि (भद्रा)'],
    month: ['Chaitra','Vaishakha','Jyeshtha','Ashadha','Shravana','Bhadrapada','Ashwin','Kartik','Margashirsha','Pausha','Magha','Phalguna'],
    monthHi: ['चैत्र','वैशाख','ज्येष्ठ','आषाढ़','श्रावण','भाद्रपद','आश्विन','कार्तिक','मार्गशीर्ष','पौष','माघ','फाल्गुन'],
    wd: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
    wdHi: ['रविवार','सोमवार','मंगलवार','बुधवार','गुरुवार','शुक्रवार','शनिवार'],
    rashi: ['Mesha','Vrishabha','Mithuna','Karka','Simha','Kanya','Tula','Vrishchika','Dhanu','Makara','Kumbha','Meena'],
    rashiHi: ['मेष','वृषभ','मिथुन','कर्क','सिंह','कन्या','तुला','वृश्चिक','धनु','मकर','कुंभ','मीन']
  };
  const tithiName = (t, hi) => {
    const k = (t - 1) % 15;
    if (k === 14) return t === 15 ? (hi ? 'पूर्णिमा' : 'Purnima') : (hi ? 'अमावस्या' : 'Amavasya');
    return (hi ? N.tithiHi : N.tithi)[k];
  };
  function karanaName(k, hi) {
    const a = hi ? N.karHi : N.kar;
    if (k === 0) return hi ? 'किंस्तुघ्न' : 'Kimstughna';
    if (k >= 57) return hi ? ['शकुनि', 'चतुष्पाद', 'नाग'][k - 57] : ['Shakuni', 'Chatushpada', 'Naga'][k - 57];
    return a[(k - 1) % 7];
  }

  /* ------------------------------------------------------------ day panchang */
  const dayCache = new Map();
  const parseKey = s => s.split('-').map(Number);
  const keyOf = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const shiftKey = (s, n) => { const [y, m, d] = parseKey(s); return keyOf(new Date(Date.UTC(y, m - 1, d + n))); };
  const pIdxFor = (t, a) => t > 15 ? (a + 1) % 12 : a;

  function tithiPoint(ms) {
    const a = atInstant(ms), mon = lunarMonthAt(ms);
    return { tithi: a.tithi, pIdx: pIdxFor(a.tithi, mon.idx), adhika: mon.adhika };
  }

  function dayInfo(dateKey, loc) {
    const ck = dateKey + '|' + loc.lat + '|' + loc.lon;
    let r = dayCache.get(ck);
    if (r) return r;
    const [y, m, d] = parseKey(dateKey);
    const sr = sunEvent(y, m, d, loc.lat, loc.lon, true), ss = sunEvent(y, m, d, loc.lat, loc.lon, false);
    const a = atInstant(sr), mon = lunarMonthAt(sr);
    const len = ss - sr, noon = (sr + ss) / 2, mid = ss + (DAY - len) / 2;
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const tEnd = crossing(elongAt, sr, 30 * HOUR, 12 * a.tithi);
    const nEnd = crossing(moonSidAt, sr, 32 * HOUR, (360 / 27) * a.nak);
    const yEnd = crossing(yogaAt, sr, 32 * HOUR, (360 / 27) * a.yoga);
    const kEnd = crossing(elongAt, sr, 16 * HOUR, 6 * (a.kar + 1));
    const nextT = (a.tithi % 30) + 1;
    const rahuIdx = [8, 2, 7, 5, 6, 4, 3][wd];
    const seg = len / 8;
    const year = y + (m <= 4 && mon.idx >= 9 ? 56 : 57);
    r = {
      date: dateKey, wd, sunrise: sr, sunset: ss, noon, midnight: mid,
      tithi: a.tithi, krishna: a.tithi > 15, tithiEnd: tEnd, nextTithi: nextT,
      nak: a.nak, nakEnd: nEnd, yoga: a.yoga, yogaEnd: yEnd, karana: a.kar, karanaEnd: kEnd,
      monthIdx: mon.idx, adhika: mon.adhika, pIdx: pIdxFor(a.tithi, mon.idx), vs: year,
      moonSid: a.moonSid,
      phase: (t => t === 30 ? 0 : t <= 6 ? 1 : t <= 9 ? 2 : t <= 14 ? 3 : t === 15 ? 4 : t <= 21 ? 5 : t <= 24 ? 6 : 7)(a.tithi),
      rahu: [sr + (rahuIdx - 1) * seg, sr + rahuIdx * seg],
      abhijit: [sr + 7 * len / 15, sr + 8 * len / 15],
      at: {} // lazily filled tithi snapshots for festival rules
    };
    dayCache.set(ck, r);
    return r;
  }
  function snap(info, w) {
    if (!info.at[w]) {
      const ms = { sunrise: info.sunrise, noon: info.noon, sunset: info.sunset, night: info.sunset + 2.5 * HOUR, midnight: info.midnight - 0.5 * HOUR,
        aparahna: info.sunrise + 0.7 * (info.sunset - info.sunrise) }[w];
      info.at[w] = tithiPoint(ms);
    }
    return info.at[w];
  }

  /* ------------------------------------------------------------ festivals */
  const EKA_S = ['Kamada','Mohini','Nirjala','Devshayani','Shravana Putrada','Parivartini','Papankusha','Devutthana','Mokshada','Pausha Putrada','Jaya','Amalaki'];
  const EKA_K = ['Papmochani','Varuthini','Apara','Yogini','Kamika','Aja','Indira','Rama','Utpanna','Saphala','Shattila','Vijaya'];
  const EKA_BIG = new Set(['Nirjala','Devshayani','Devutthana','Mokshada']);
  const EKA_HI = { Kamada:'कामदा', Mohini:'मोहिनी', Nirjala:'निर्जला', Devshayani:'देवशयनी', 'Shravana Putrada':'श्रावण पुत्रदा', Parivartini:'परिवर्तिनी', Papankusha:'पापांकुशा', Devutthana:'देवउठनी', Mokshada:'मोक्षदा', 'Pausha Putrada':'पौष पुत्रदा', Jaya:'जया', Amalaki:'आमलकी', Papmochani:'पापमोचिनी', Varuthini:'वरूथिनी', Apara:'अपरा', Yogini:'योगिनी', Kamika:'कामिका', Aja:'अजा', Indira:'इंदिरा', Rama:'रमा', Utpanna:'उत्पन्ना', Saphala:'सफला', Shattila:'षटतिला', Vijaya:'विजया' };

  // type: 'f' festival, 'v' vrat / observance. big = shown prominently. w = time of day the tithi must prevail.
  const RULES = [];
  const rule = (name, hi, m, t, w, o) => RULES.push(Object.assign({ name, hi, m, t: [].concat(t), w: w || 'sunrise', type: 'f' }, o));
  rule('Hindu New Year · Gudi Padwa · Chaitra Navratri begins', 'नव संवत्सर · गुड़ी पड़वा', 0, 1, 'sunrise', { big: 1 });
  rule(c => `Chaitra Navratri · Day ${c.t}`, c => `चैत्र नवरात्रि · दिन ${c.t}`, 0, [2, 3, 4, 5, 6, 7, 8], 'sunrise', { type: 'v' });
  rule('Ram Navami', 'राम नवमी', 0, 9, 'noon', { big: 1 });
  rule('Mahavir Jayanti', 'महावीर जयंती', 0, 13, 'sunrise');
  rule('Hanuman Jayanti', 'हनुमान जयंती', 0, 15, 'sunrise', { big: 1 });
  rule('Akshaya Tritiya', 'अक्षय तृतीया', 1, 3, 'noon', { big: 1 });
  rule('Buddha Purnima', 'बुद्ध पूर्णिमा', 1, 15, 'sunrise', { big: 1 });
  rule('Ganga Dussehra', 'गंगा दशहरा', 2, 10, 'sunrise');
  rule('Vat Savitri Vrat', 'वट सावित्री व्रत', 2, 30, 'sunrise');
  rule('Jagannath Rath Yatra', 'रथ यात्रा', 3, 2, 'sunrise', { big: 1 });
  rule('Guru Purnima', 'गुरु पूर्णिमा', 3, 15, 'sunrise', { big: 1 });
  rule('Hariyali Teej', 'हरियाली तीज', 4, 3, 'sunrise');
  rule('Nag Panchami', 'नाग पंचमी', 4, 5, 'sunrise');
  rule('Raksha Bandhan', 'रक्षा बंधन', 4, 15, 'sunrise', { big: 1 });
  rule('Janmashtami (Smarta)', 'जन्माष्टमी', 5, 23, 'midnight', { big: 1 });
  rule('Hartalika Teej', 'हरतालिका तीज', 5, 3, 'sunrise');
  rule('Ganesh Chaturthi', 'गणेश चतुर्थी', 5, 4, 'noon', { big: 1 });
  rule('Anant Chaturdashi · Ganesh Visarjan', 'अनंत चतुर्दशी', 5, 14, 'sunrise');
  rule('Pitru Paksha · Shraddha', 'पितृ पक्ष · श्राद्ध', 6, [16,17,18,19,20,21,22,23,24,25,26,27,28,29], 'sunrise', { type: 'v' });
  rule('Sarva Pitru Amavasya', 'सर्वपितृ अमावस्या', 6, 30, 'sunrise', { big: 1 });
  rule(c => c.t === 1 ? 'Sharad Navratri begins · Ghatasthapana' : c.t === 8 ? 'Durga Ashtami · Navratri Day 8' : c.t === 9 ? 'Maha Navami · Navratri Day 9' : `Sharad Navratri · Day ${c.t}`,
       c => c.t === 1 ? 'शारदीय नवरात्रि आरंभ · घटस्थापना' : c.t === 8 ? 'दुर्गा अष्टमी' : c.t === 9 ? 'महानवमी' : `शारदीय नवरात्रि · दिन ${c.t}`, 6, [1,2,3,4,5,6,7,8,9], 'sunrise', { big: 0, bigT: [1, 8, 9] });
  rule('Dussehra · Vijayadashami', 'दशहरा · विजयादशमी', 6, 10, 'aparahna', { big: 1 });
  rule('Sharad Purnima', 'शरद पूर्णिमा', 6, 15, 'night', { big: 1 });
  rule('Karwa Chauth', 'करवा चौथ', 7, 19, 'night', { big: 1 });
  rule('Ahoi Ashtami', 'अहोई अष्टमी', 7, 23, 'night');
  rule('Dhanteras', 'धनतेरस', 7, 28, 'sunset', { big: 1 });
  rule('Naraka Chaturdashi · Choti Diwali', 'नरक चतुर्दशी · छोटी दिवाली', 7, 29, 'sunrise', { big: 1 });
  rule('Diwali · Lakshmi Puja', 'दीपावली · लक्ष्मी पूजन', 7, 30, 'sunset', { big: 1 });
  rule('Govardhan Puja · Annakut', 'गोवर्धन पूजा', 7, 1, 'sunrise', { big: 1 });
  rule('Bhai Dooj', 'भाई दूज', 7, 2, 'aparahna', { big: 1 });
  rule('Chhath Puja', 'छठ पूजा', 7, 6, 'sunset', { big: 1 });
  rule('Kartik Purnima · Dev Deepawali · Guru Nanak Jayanti', 'कार्तिक पूर्णिमा · देव दिवाली', 7, 15, 'sunrise', { big: 1 });
  rule('Vivah Panchami', 'विवाह पंचमी', 8, 5, 'sunrise');
  rule('Gita Jayanti', 'गीता जयंती', 8, 11, 'sunrise');
  rule('Dattatreya Jayanti', 'दत्तात्रेय जयंती', 8, 15, 'sunrise');
  rule('Paush Purnima', 'पौष पूर्णिमा', 9, 15, 'sunrise');
  rule('Mauni Amavasya', 'मौनी अमावस्या', 10, 30, 'sunrise', { big: 1 });
  rule('Vasant Panchami', 'वसंत पंचमी', 10, 5, 'sunrise', { big: 1 });
  rule('Ratha Saptami', 'रथ सप्तमी', 10, 7, 'sunrise');
  rule('Magha Purnima', 'माघ पूर्णिमा', 10, 15, 'sunrise');
  rule('Maha Shivaratri', 'महाशिवरात्रि', 11, 29, 'midnight', { big: 1 });
  // monthly observances (any month)
  rule(c => `${c.k ? EKA_K[c.p] : EKA_S[c.p]} Ekadashi`, c => `${EKA_HI[c.k ? EKA_K[c.p] : EKA_S[c.p]]} एकादशी`, null, [11, 26], 'sunrise', { type: 'v', generic: 1 });
  rule('Purnima', 'पूर्णिमा', null, 15, 'sunrise', { type: 'v', generic: 1 });
  rule('Amavasya', 'अमावस्या', null, 30, 'sunrise', { type: 'v', generic: 1 });
  rule('Pradosh Vrat', 'प्रदोष व्रत', null, [13, 28], 'sunset', { type: 'v', generic: 1 });
  rule('Sankashti Chaturthi', 'संकष्टी चतुर्थी', null, 19, 'night', { type: 'v', generic: 1 });
  rule('Vinayaka Chaturthi', 'विनायक चतुर्थी', null, 4, 'noon', { type: 'v', generic: 1 });

  const fixed = [
    [1, 1, 'New Year’s Day', 'नव वर्ष'], [1, 12, 'National Youth Day', 'राष्ट्रीय युवा दिवस'], [1, 13, 'Lohri', 'लोहड़ी'], [1, 23, 'Netaji Jayanti', 'नेताजी जयंती'],
    [1, 26, 'Republic Day', 'गणतंत्र दिवस', 1], [4, 14, 'Ambedkar Jayanti', 'अम्बेडकर जयंती'], [5, 1, 'Labour Day', 'श्रमिक दिवस'],
    [8, 15, 'Independence Day', 'स्वतंत्रता दिवस', 1], [9, 5, 'Teachers’ Day', 'शिक्षक दिवस'], [10, 2, 'Gandhi Jayanti', 'गांधी जयंती', 1],
    [10, 31, 'Sardar Patel Jayanti', 'सरदार पटेल जयंती'], [11, 14, 'Children’s Day', 'बाल दिवस'], [12, 25, 'Christmas', 'क्रिसमस', 1]
  ];
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(y, mo - 1, da);
  }

  /** Holika Dahan: the first day on which Purnima prevails at pradosh (sunset). Bhadra only moves the muhurta
   *  within that night (after Bhadra, or Bhadra Puccha), not the date. Returns the day shift (0) or null. */
  function holikaShift(s, loc) {
    const info = dayInfo(s, loc), prev = dayInfo(shiftKey(s, -1), loc);
    const isP = i => { const a = snap(i, 'sunset'); return a.tithi === 15 && a.pIdx === 11 && !a.adhika; };
    return isP(info) && !isP(prev) ? 0 : null;
  }

  const matchCache = new Map();
  /** Rule matches whose observance starts at source day `s` (before applying the day offset). */
  function matchesOn(s, loc) {
    const ck = s + '|' + loc.lat + '|' + loc.lon;
    if (matchCache.has(ck)) return matchCache.get(ck);
    const info = dayInfo(s, loc), prev = dayInfo(shiftKey(s, -1), loc), next = dayInfo(shiftKey(s, 1), loc);
    const out = [];
    const skipped = ((next.tithi - info.tithi + 30) % 30) === 2 ? (info.tithi % 30) + 1 : 0; // kshaya tithi falls within this day
    const hs = holikaShift(s, loc);
    if (hs !== null) {
      out.push({ name: 'Holika Dahan', hi: 'होलिका दहन', type: 'f', big: true, off: hs, tithi: 15, generic: false });
      out.push({ name: 'Holi', hi: 'होली', type: 'f', big: true, off: hs + 1, tithi: 15, generic: false });
    }
    for (const r of RULES) {
      const cands = [];
      if (r.w === 'sunrise') {
        if (prev.tithi !== info.tithi) cands.push({ tithi: info.tithi, pIdx: info.pIdx, adhika: info.adhika });
        if (skipped) { const m2 = lunarMonthAt(info.tithiEnd + HOUR); cands.push({ tithi: skipped, pIdx: pIdxFor(skipped, m2.idx), adhika: m2.adhika }); }
      } else {
        const now = snap(info, r.w), before = snap(prev, r.w);
        if (now.tithi !== before.tithi || now.pIdx !== before.pIdx) cands.push(now);
      }
      for (const at of cands) {
        if (at.adhika) continue;
        if (r.m !== null && r.m !== at.pIdx) continue;
        if (!r.t.includes(at.tithi)) continue;
        const ctx = { t: at.tithi, p: at.pIdx, k: at.tithi > 15 };
        const nm = typeof r.name === 'function' ? r.name(ctx) : r.name;
        const hi = typeof r.hi === 'function' ? r.hi(ctx) : r.hi;
        let big = !!r.big;
        if (r.bigT) big = r.bigT.includes(at.tithi);
        if (r.generic && /Ekadashi$/.test(nm)) { const base = nm.replace(' Ekadashi', ''); big = EKA_BIG.has(base); }
        out.push({ name: nm, hi, type: r.type, big, off: r.off || 0, tithi: at.tithi, generic: !!r.generic });
      }
    }
    matchCache.set(ck, out);
    return out;
  }

  function sankrantiOn(dateKey, loc) {
    const a = dayInfo(shiftKey(dateKey, -1), loc), b = dayInfo(dateKey, loc);
    const s0 = Math.floor(sunSidAt(a.sunset) / 30), s1 = Math.floor(sunSidAt(b.sunset) / 30);
    if (s0 === s1) return null;
    const sign = s1;
    const special = { 9: ['Makar Sankranti · Uttarayan', 'मकर संक्रांति · उत्तरायण', true], 0: ['Mesha Sankranti · Baisakhi · Vishu', 'मेष संक्रांति · बैसाखी', true], 3: ['Karka Sankranti', 'कर्क संक्रांति', false] }[sign];
    return special ? { name: special[0], hi: special[1], type: 'f', big: special[2] } :
      { name: `${N.rashi[sign]} Sankranti`, hi: `${N.rashiHi[sign]} संक्रांति`, type: 'v', big: false };
  }

  /** All events falling on dateKey (festivals, vrats, holidays), biggest first. */
  function eventsFor(dateKey, loc) {
    const found = [];
    for (let back = 0; back <= 2; back++) {
      const s = shiftKey(dateKey, -back);
      for (const e of matchesOn(s, loc)) if (e.off === back) found.push(e);
    }
    // a specific festival on Purnima/Amavasya hides the generic label for the same tithi
    const specific = new Set(found.filter(e => !e.generic).map(e => e.tithi));
    let ev = found.filter(e => !(e.generic && (e.tithi === 15 || e.tithi === 30) && specific.has(e.tithi)));
    const sk = sankrantiOn(dateKey, loc); if (sk) ev.push(sk);
    const [y, m, d] = parseKey(dateKey), ms = Date.UTC(y, m - 1, d);
    for (const f of fixed) if (f[0] === m && f[1] === d) ev.push({ name: f[2], hi: f[3], type: 'f', big: !!f[4] });
    const es = easter(y);
    if (ms === es) ev.push({ name: 'Easter', hi: 'ईस्टर', type: 'f', big: false });
    if (ms === es - 2 * DAY) ev.push({ name: 'Good Friday', hi: 'गुड फ्राइडे', type: 'f', big: true });
    const seen = new Set();
    ev = ev.filter(e => !seen.has(e.name) && seen.add(e.name));
    ev.sort((a, b) => (b.big - a.big) || (a.type === 'f' ? -1 : 1) - (b.type === 'f' ? -1 : 1));
    return ev;
  }

  /* ------------------------------------------------------------ formatting helpers */
  function timeStr(ms, tz, baseKey) {
    const d = new Date(ms + tz * HOUR);
    const h = d.getUTCHours(), mi = d.getUTCMinutes();
    let s = `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    if (baseKey && keyOf(d) !== baseKey) s += keyOf(d) > baseKey ? ' (next day)' : ' (prev day)';
    return s;
  }

  function describe(dateKey, loc, hi) {
    const i = dayInfo(dateKey, loc), tz = loc.tz;
    const mi = (hi ? N.monthHi : N.month)[i.monthIdx];
    return {
      info: i,
      tithi: tithiName(i.tithi, hi), nextTithi: tithiName(i.nextTithi, hi),
      paksha: i.krishna ? (hi ? 'कृष्ण पक्ष' : 'Krishna Paksha') : (hi ? 'शुक्ल पक्ष' : 'Shukla Paksha'),
      nak: (hi ? N.nakHi : N.nak)[i.nak - 1], yoga: (hi ? N.yogaHi : N.yoga)[i.yoga - 1], karana: karanaName(i.karana, hi),
      month: (i.adhika ? (hi ? 'अधिक ' : 'Adhika ') : '') + mi,
      monthP: (i.adhika ? (hi ? 'अधिक ' : 'Adhika ') : '') + (hi ? N.monthHi : N.month)[i.pIdx],
      weekday: (hi ? N.wdHi : N.wd)[i.wd],
      t: ms => timeStr(ms, tz, dateKey)
    };
  }

  const PHASE = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];

  root.Panchang = {
    dayInfo, eventsFor, describe, tithiName, timeStr, N, PHASE, keyOf, shiftKey,
    _internals: { sunLon, moonLon, ayanamsa, elongAt, lunarMonthAt, sunEvent, atInstant, sunSidAt, moonSidAt, easter }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Panchang;
})(typeof window !== 'undefined' ? window : globalThis);

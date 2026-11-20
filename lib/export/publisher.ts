// 매체 주소(도메인)를 언론사명으로 바꾼다. 표에 없는 주소는 서브도메인·.co.kr 등을 뗀 이름으로 보여 주고, 검토 화면에서 고칠 수 있다.
const NAMES: Record<string, string> = {
  "mk.co.kr": "매일경제", "stock.mk.co.kr": "매일경제", "yna.co.kr": "연합뉴스", "yonhapnewstv.co.kr": "연합뉴스TV",
  "dailian.co.kr": "데일리안", "news1.kr": "뉴스1", "mt.co.kr": "머니투데이", "etnews.com": "전자신문",
  "digitaltoday.co.kr": "디지털투데이", "newscj.com": "천지일보", "fnnews.com": "파이낸셜뉴스", "imnews.imbc.com": "MBC",
  "newsis.com": "뉴시스", "mobile.newsis.com": "뉴시스", "kasa.go.kr": "우주항공청", "go.seoul.co.kr": "서울신문",
  "asiae.co.kr": "아시아경제", "biz.chosun.com": "조선비즈", "enewstoday.co.kr": "이뉴스투데이", "news.bbsi.co.kr": "BBS불교방송",
  "sedaily.com": "서울경제", "itbiznews.com": "IT비즈뉴스", "inews24.com": "아이뉴스24", "news.jkn.co.kr": "JKN",
  "hankyung.com": "한국경제", "econovill.com": "이코노믹리뷰", "nocutnews.co.kr": "노컷뉴스", "munhwa.com": "문화일보",
  "zdnet.co.kr": "지디넷코리아", "news.ifm.kr": "경인방송", "edaily.co.kr": "이데일리", "m.dnews.co.kr": "대한경제",
  "etoday.co.kr": "이투데이", "efocus.co.kr": "이포커스", "ajunews.com": "아주경제", "joongang.co.kr": "중앙일보",
  "smarttoday.co.kr": "스마트투데이", "electimes.com": "전기신문", "ddaily.co.kr": "디지털데일리", "biz.heraldcorp.com": "헤럴드경제",
  "ekn.kr": "에너지경제", "news.einfomax.co.kr": "연합인포맥스", "biz.newdaily.co.kr": "뉴데일리경제", "boannews.com": "보안뉴스",
  "donga.com": "동아일보", "news.kbs.co.kr": "KBS", "news.jtbc.co.kr": "JTBC", "segye.com": "세계일보",
  "businesspost.co.kr": "비즈니스포스트", "newspim.com": "뉴스핌", "seoulfn.com": "서울파이낸스", "koreaittimes.com": "코리아IT타임즈",
  "news.lghellovision.net": "LG헬로비전", "hellot.net": "헬로티", "kyeonggi.com": "경기일보", "tjb.co.kr": "TJB",
  "joongboo.com": "중부일보", "incheonilbo.com": "인천일보", "kgnews.co.kr": "경기신문", "newsworks.co.kr": "뉴스웍스",
  "sijung.co.kr": "시정일보", "gukjenews.com": "국제뉴스", "safetynews.co.kr": "안전신문", "kpenews.com": "한국플랜트뉴스",
  "wooriilbo.com": "우리일보", "nuriilbo.com": "누리일보", "paxetv.com": "팍스경제TV", "newsdream.kr": "뉴스드림",
  "lawtv.kr": "법률방송", "metroseoul.co.kr": "메트로신문", "adtimes.co.kr": "애드타임스", "m.tf.co.kr": "더팩트",
};

/** 도메인 → 언론사명. 표에 없으면 앞의 www./m./news. 등과 맨 뒤 .co.kr 등을 뗀 이름을 돌려준다. */
export function publisherName(domain: string): string {
  const host = domain.trim().toLowerCase();
  if (NAMES[host]) return NAMES[host];
  const labels = host.replace(/^(www|m|mobile|news|biz|stock)\./, "").split(".");
  const stripped = labels.length > 2 && ["co", "or", "go", "ne"].includes(labels[labels.length - 2]) ? labels.slice(0, -2) : labels.slice(0, -1);
  return stripped.join(".") || host;
}

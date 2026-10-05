"use client";

const countryMeta: Record<string, { flag: string; language: string }> = {
  Albania:{flag:"🇦🇱",language:"SQ"}, Andorra:{flag:"🇦🇩",language:"CA"}, Armenia:{flag:"🇦🇲",language:"HY"}, Austria:{flag:"🇦🇹",language:"DE"},
  Azerbaijan:{flag:"🇦🇿",language:"AZ"}, Belarus:{flag:"🇧🇾",language:"BE"}, Belgium:{flag:"🇧🇪",language:"NL / FR"}, Bosnia:{flag:"🇧🇦",language:"BS"}, "Bosnia and Herzegovina":{flag:"🇧🇦",language:"BS"},
  Bulgaria:{flag:"🇧🇬",language:"BG"}, Croatia:{flag:"🇭🇷",language:"HR"}, Cyprus:{flag:"🇨🇾",language:"EL"}, Czechia:{flag:"🇨🇿",language:"CS"},
  Denmark:{flag:"🇩🇰",language:"DA"}, Estonia:{flag:"🇪🇪",language:"ET"}, Finland:{flag:"🇫🇮",language:"FI"}, France:{flag:"🇫🇷",language:"FR"},
  Georgia:{flag:"🇬🇪",language:"KA"}, Germany:{flag:"🇩🇪",language:"DE"}, Greece:{flag:"🇬🇷",language:"EL"}, Hungary:{flag:"🇭🇺",language:"HU"},
  Iceland:{flag:"🇮🇸",language:"IS"}, Ireland:{flag:"🇮🇪",language:"EN"}, Israel:{flag:"🇮🇱",language:"HE"}, Italy:{flag:"🇮🇹",language:"IT"},
  Kosovo:{flag:"🇽🇰",language:"SQ"}, Latvia:{flag:"🇱🇻",language:"LV"}, Lithuania:{flag:"🇱🇹",language:"LT"}, Luxembourg:{flag:"🇱🇺",language:"LB"},
  Malta:{flag:"🇲🇹",language:"MT"}, Moldova:{flag:"🇲🇩",language:"RO"}, Montenegro:{flag:"🇲🇪",language:"ME"}, Netherlands:{flag:"🇳🇱",language:"NL"},
  "North Macedonia":{flag:"🇲🇰",language:"MK"}, Norway:{flag:"🇳🇴",language:"NO"}, Poland:{flag:"🇵🇱",language:"PL"}, Portugal:{flag:"🇵🇹",language:"PT"},
  Romania:{flag:"🇷🇴",language:"RO"}, Russia:{flag:"🇷🇺",language:"RU"}, Serbia:{flag:"🇷🇸",language:"SR"}, Slovakia:{flag:"🇸🇰",language:"SK"},
  Slovenia:{flag:"🇸🇮",language:"SL"}, Spain:{flag:"🇪🇸",language:"ES"}, Sweden:{flag:"🇸🇪",language:"SV"}, Switzerland:{flag:"🇨🇭",language:"DE / FR / IT"},
  Türkiye:{flag:"🇹🇷",language:"TR"}, Turkey:{flag:"🇹🇷",language:"TR"}, Ukraine:{flag:"🇺🇦",language:"UK"}, "United Kingdom":{flag:"🇬🇧",language:"EN"},
  "United States":{flag:"🇺🇸",language:"EN"}, Canada:{flag:"🇨🇦",language:"EN / FR"}, Mexico:{flag:"🇲🇽",language:"ES"}, China:{flag:"🇨🇳",language:"ZH"},
  Japan:{flag:"🇯🇵",language:"JA"}, "South Korea":{flag:"🇰🇷",language:"KO"}, "United Arab Emirates":{flag:"🇦🇪",language:"AR"}, Israel:{flag:"🇮🇱",language:"HE"}
};

export default function GeoBadge({ country, regional = false }: { country: string | null; regional?: boolean }) {
  const meta = regional || country === "Europe" ? { flag: "🇪🇺", language: "EU" } : countryMeta[country || ""];
  if (!meta) return null;
  return <span className="geo-badge" title={"Primary language: " + meta.language}><span>{meta.flag}</span><b>{meta.language}</b></span>;
}

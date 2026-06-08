export const QUOTE_BANNER_SETTINGS_CHANGED_EVENT = "camerahub-quote-banner-settings-changed";
export const DEFAULT_QUOTE_INTERVAL_SECONDS = 15;

export const DEFAULT_QUOTE_LINES = [
  "“If your pictures aren't good enough, you're not close enough.” —— Robert Capa",
  "“A photograph is a secret about a secret. The more it tells you, the less you know.” —— Diane Arbus",
  "“To photograph is to put on the same line of sight the head, the eye and the heart.” —— Henri Cartier-Bresson",
  "“Photography is a way of feeling, of touching, of loving.” —— Aaron Siskind",
  "“The camera is an instrument that teaches people how to see without a camera.” —— Dorothea Lange",
  "“You don't take a photograph, you make it.” —— Ansel Adams",
  "“A good photograph is knowing where to stand.” —— Ansel Adams",
  "“The whole point of taking pictures is so that you don't have to explain things with words.” —— Elliott Erwitt",
  "“There is one thing the photograph must contain, the humanity of the moment.” —— Robert Frank",
  "“Taking pictures is savoring life intensely, every hundredth of a second.” —— Marc Riboud",
  "“What I like about photographs is that they capture a moment that’s gone forever, impossible to reproduce.” —— Karl Lagerfeld",
  "“The best thing about a picture is that it never changes, even when the people in it do.” —— Andy Warhol",
  "“I've been taking pictures all my life, long before I had a camera.” ——《一小时快照》",
  "“If it makes me laugh, if it makes me cry, if it rips out my heart, that's a good picture.” ——《一小时快照》",
  "“Sometimes I think all anyone needs in life is lots of popcorn and a few Lovelies.” ——《皮毛》",
  "“You don't make up for your sins in church. You do it in the streets. You do it at home.” ——《穷街陋巷》",
  "“Taking pictures is like tiptoeing into the kitchen late at night and stealing Oreo cookies.” —— Diane Arbus",
  "“I really believe there are things nobody would see if I didn't photograph them.” —— Diane Arbus",
  "“Which of my photographs is my favorite? The one I'm going to take tomorrow.” —— Imogen Cunningham",
  "“I photograph to find out what something will look like photographed.” —— Garry Winogrand",
  "“The world just does not fit conveniently into the format of a 35mm camera.” —— W. Eugene Smith",
  "“Your first 10,000 photographs are your worst.” —— Henri Cartier-Bresson",
  "“It's not what you look at that matters, it's what you see.” —— Henry David Thoreau",
  "“There are no rules for good photographs, there are only good photographs.” —— Ansel Adams",
  "“Wherever there is light, one can photograph.” —— Alfred Stieglitz",
  "“Once photography enters your bloodstream, it is like a disease.” —— Anonymous",
  "“Look and think before opening the shutter. The heart and mind are the true lens of the camera.” —— Yousuf Karsh",
  "“In photography there is a reality so subtle that it becomes more real than reality.” —— Alfred Stieglitz",
  "“Photographs open doors into the past, but they also allow a look into the future.” —— Sally Mann",
  "“Photography helps people to see.” —— Berenice Abbott",
  "光落下来的时候，故事开始生长。",
  "按下快门，是向时间借来的一次停留。",
  "有些风景会消失，有些照片会留下。",
  "镜头记录世界，也记录当时的自己。",
  "照片不会说话，却能让人沉默很久。",
  "每一次对焦，都是一次选择。",
  "世界一直都在那里，只是等待被看见。",
  "时间向前走，照片向后看。",
  "那些来不及说出口的话，都留在了光影里。",
  "把转瞬即逝，变成永恒。",
  "有些瞬间只存在一秒，却值得记住一生。",
  "镜头之外是生活，镜头之内是答案。",
  "真正打动人的，从来不是风景，而是风景里的情绪。",
  "光影有尽头，记忆没有。",
  "所有伟大的照片，本质上都在讲述同一个故事：我们曾经在这里。",
  "“To see the world, things dangerous to come to, to see behind walls, draw closer, to find each other, and to feel. That is the purpose of life.” ——《白日梦想家》",
  "“Beautiful things don't ask for attention.” ——《白日梦想家》",
  "“If I like a moment, I mean me, personally, I don't like to have the distraction of the camera. I just want to stay in it.” ——《白日梦想家》",
  "“Sometimes I don't. If I like a moment, for me, personally, I don't like to have the distraction of the camera. I just want to stay in it.” ——《白日梦想家》"
] as const;

export type QuoteBannerSettings = {
  intervalSeconds: number;
  quotes: string[];
};

export const DEFAULT_QUOTE_BANNER_SETTINGS: QuoteBannerSettings = {
  intervalSeconds: DEFAULT_QUOTE_INTERVAL_SECONDS,
  quotes: [...DEFAULT_QUOTE_LINES]
};

function normalizeIntervalSeconds(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_QUOTE_INTERVAL_SECONDS;
  }

  return Math.min(3600, Math.max(3, Math.floor(value)));
}

function normalizeQuotes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_QUOTE_LINES];
  }

  const quotes = value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);

  return quotes.length > 0 ? quotes : [...DEFAULT_QUOTE_LINES];
}

export function normalizeQuoteBannerSettings(value: Partial<QuoteBannerSettings> | null | undefined): QuoteBannerSettings {
  return {
    intervalSeconds: normalizeIntervalSeconds(value?.intervalSeconds),
    quotes: normalizeQuotes(value?.quotes)
  };
}

export function splitQuoteLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function serializeQuoteLines(quotes: string[]): string {
  return quotes.join("\n");
}

export function pickRandomIndex(count: number, previousIndex?: number | null): number {
  if (count <= 1) {
    return 0;
  }

  const previous = typeof previousIndex === "number" && previousIndex >= 0 && previousIndex < count ? previousIndex : null;
  const base = Math.floor(Math.random() * (count - 1));

  if (previous === null) {
    return Math.floor(Math.random() * count);
  }

  return base >= previous ? base + 1 : base;
}

from pathlib import Path

from fastapi import APIRouter

from app.database import PROJECT_ROOT
from app.schemas import QuoteBannerSettingsRead, QuoteBannerSettingsUpdate


router = APIRouter(prefix="/quote-banner", tags=["quote_banner"])

DEFAULT_INTERVAL_SECONDS = 15
QUOTE_BANNER_DATA_PATH = PROJECT_ROOT / "data" / "quote_banner.txt"
DEFAULT_QUOTE_LINES = [
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
    "“Sometimes I don't. If I like a moment, for me, personally, I don't like to have the distraction of the camera. I just want to stay in it.” ——《白日梦想家》",
]


def _normalize_interval_seconds(value: int | None) -> int:
    if value is None:
        return DEFAULT_INTERVAL_SECONDS
    return max(3, min(3600, int(value)))


def _normalize_quotes(value: list[str] | None) -> list[str]:
    if value is None:
        return []
    return [line.strip() for line in value if line.strip()]


def _parse_settings_file(path: Path) -> tuple[int | None, list[str]]:
    if not path.exists():
        return None, []

    raw_lines = path.read_text(encoding="utf-8").splitlines()
    if not raw_lines:
        return None, []

    interval_seconds: int | None = None
    quotes: list[str] = []

    for index, line in enumerate(raw_lines):
        stripped = line.strip()
        if index == 0 and stripped.startswith("interval_seconds="):
            try:
                interval_seconds = int(stripped.split("=", 1)[1].strip())
            except ValueError:
                interval_seconds = None
            continue

        if stripped:
            quotes.append(stripped)

    return interval_seconds, quotes


def _build_settings_response() -> QuoteBannerSettingsRead:
    uses_default = not QUOTE_BANNER_DATA_PATH.exists()
    interval_seconds, quotes = _parse_settings_file(QUOTE_BANNER_DATA_PATH)
    normalized_quotes = _normalize_quotes(quotes)

    return QuoteBannerSettingsRead(
        interval_seconds=_normalize_interval_seconds(interval_seconds),
        quotes=normalized_quotes or list(DEFAULT_QUOTE_LINES),
        uses_default_interval=uses_default,
        uses_default_quotes=uses_default,
    )


def _write_settings_file(interval_seconds: int, quotes: list[str]) -> None:
    QUOTE_BANNER_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"interval_seconds={_normalize_interval_seconds(interval_seconds)}", ""]
    lines.extend(_normalize_quotes(quotes) or list(DEFAULT_QUOTE_LINES))
    QUOTE_BANNER_DATA_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


@router.get("", response_model=QuoteBannerSettingsRead)
def get_quote_banner_settings() -> QuoteBannerSettingsRead:
    return _build_settings_response()


@router.put("", response_model=QuoteBannerSettingsRead)
def update_quote_banner_settings(payload: QuoteBannerSettingsUpdate) -> QuoteBannerSettingsRead:
    interval_seconds = _normalize_interval_seconds(payload.interval_seconds)
    quotes = _normalize_quotes(payload.quotes)
    _write_settings_file(interval_seconds, quotes)
    return _build_settings_response()


@router.delete("", response_model=QuoteBannerSettingsRead)
def reset_quote_banner_settings() -> QuoteBannerSettingsRead:
    if QUOTE_BANNER_DATA_PATH.exists():
        QUOTE_BANNER_DATA_PATH.unlink()
    return _build_settings_response()

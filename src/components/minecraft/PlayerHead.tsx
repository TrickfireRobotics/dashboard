const SIZE = 24;

const SKIN_TEXTURE_HOSTS = ["s.namemc.com/i/", "textures.minecraft.net/texture/"];

function isRawSkinTexture(url: string) {
    return SKIN_TEXTURE_HOSTS.some((h) => url.includes(h));
}

export function resolveAvatarSrc(name: string, skinSource?: string): string {
    if (skinSource) {
        if (skinSource.startsWith("http://") || skinSource.startsWith("https://")) {
            return skinSource;
        }
        return `https://mc-heads.net/avatar/${skinSource}/${SIZE}`;
    }
    return `https://mc-heads.net/avatar/${name}/${SIZE}`;
}

export function PlayerHead({
    name,
    skinSource,
}: {
    name: string;
    skinSource?: string;
}) {
    const src = resolveAvatarSrc(name, skinSource);

    if (isRawSkinTexture(src)) {
        const px = SIZE / 8;
        const bgSize = 64 * px;
        const bgPos = -(8 * px);

        return (
            <div
                className="shrink-0 rounded-sm"
                style={{
                    width: SIZE,
                    height: SIZE,
                    backgroundImage: `url(${src})`,
                    backgroundSize: `${bgSize}px ${bgSize}px`,
                    backgroundPosition: `${bgPos}px ${bgPos}px`,
                    imageRendering: "pixelated",
                }}
                aria-label={name}
            />
        );
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={name}
            width={SIZE}
            height={SIZE}
            className="shrink-0 rounded-sm"
        />
    );
}

import { cn } from "@/lib/utils";

const DEFAULT_SIZE = 24;

const SKIN_TEXTURE_HOSTS = ["s.namemc.com/i/", "textures.minecraft.net/texture/"];

function isRawSkinTexture(url: string) {
    return SKIN_TEXTURE_HOSTS.some((h) => url.includes(h));
}

export function resolveAvatarSrc(name: string, skinSource?: string, size = DEFAULT_SIZE): string {
    if (skinSource) {
        if (skinSource.startsWith("http://") || skinSource.startsWith("https://")) {
            return skinSource;
        }
        return `https://mc-heads.net/avatar/${skinSource}/${size}`;
    }
    return `https://mc-heads.net/avatar/${name}/${size}`;
}

export function PlayerHead({
    name,
    skinSource,
    isSkin,
    size = DEFAULT_SIZE,
    className,
}: {
    name: string;
    skinSource?: string;
    isSkin?: boolean;
    size?: number;
    className?: string;
}) {
    const src = resolveAvatarSrc(name, skinSource, size);

    if (isSkin || isRawSkinTexture(src)) {
        const px = size / 8;
        const bgSize = 64 * px;
        const bgPos = -(8 * px);

        return (
            <div
                className={cn("shrink-0 rounded-sm", className)}
                style={{
                    width: size,
                    height: size,
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
            width={size}
            height={size}
            className={cn("shrink-0 rounded-sm", className)}
        />
    );
}

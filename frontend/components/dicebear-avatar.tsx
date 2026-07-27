/**
 * DiceBear 头像组件
 * 基于 seed 生成 SVG 头像，无网络请求
 */
'use client';

import { createAvatar } from '@dicebear/core';
import * as style from '@dicebear/collection';
import { useMemo } from 'react';

const STYLES: Record<string, any> = {
  micah: style.micah,
  bottts: style.bottts,
  adventurer: style.adventurer,
  notionists: style.notionists,
  lorelei: style.lorelei,
};

export function DiceBearAvatar({
  seed,
  size = 40,
  shape = 'circle',
}: {
  seed: string;
  size?: number;
  shape?: 'circle' | 'square';
}) {
  const dataUri = useMemo(() => {
    const avatar = createAvatar(STYLES.micah, {
      seed,
      size: size * 2, // 2x 渲染保证清晰
      radius: shape === 'circle' ? 50 : 10,
    });
    return avatar.toDataUri();
  }, [seed, size, shape]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUri}
      alt={`${seed} 头像`}
      width={size}
      height={size}
      className={`shrink-0 ${shape === 'circle' ? 'rounded-full' : 'rounded-md'}`}
      style={{ width: size, height: size }}
    />
  );
}

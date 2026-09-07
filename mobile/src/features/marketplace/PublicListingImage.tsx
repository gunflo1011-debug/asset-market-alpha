import React, { memo, useEffect, useMemo, useState } from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { premiumColors } from '../../lib/premiumTheme';

type Props = {
  uri?: string | null;
  accessibilityLabel: string;
  style: StyleProp<ViewStyle>;
  fallbackLabel?: string;
};

function PublicListingImageComponent({
  uri,
  accessibilityLabel,
  style,
  fallbackLabel = 'Public photo unavailable',
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const source = useMemo(() => (uri ? { uri } : null), [uri]);

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  if (source && !imageFailed) {
    return (
      <View style={[styles.frame, style]}>
        <Image
          source={source}
          style={styles.image}
          resizeMode="cover"
          fadeDuration={0}
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
          onError={() => setImageFailed(true)}
        />
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${accessibilityLabel}. ${fallbackLabel}`}
      style={[styles.frame, styles.placeholder, style]}
    >
      <Text style={styles.placeholderEyebrow}>PHOTO</Text>
      <Text style={styles.placeholderText}>{fallbackLabel}</Text>
    </View>
  );
}

export const PublicListingImage = memo(PublicListingImageComponent);

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: premiumColors.imagePlaceholder,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: premiumColors.imagePlaceholderBorder,
  },
  placeholderEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: premiumColors.textSubtle,
  },
  placeholderText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
    color: premiumColors.imagePlaceholderText,
  },
});

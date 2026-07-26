/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#DC2626', // AGL Red
          600: '#B91C1C', // AGL Red 2
          700: '#991B1B',
          800: '#7F1D1D',
          900: '#450A0A',
        },
        canvas: '#FAFAFA',
        muted: '#F5F5F5',
        body: '#212121',
        line: '#E5E5E5',
        edge: '#D4D4D4',
        // Aliases used by the original luxury-themed pages. Map to the AGL
        // tokens above so existing markup (ink-900, cream, warning) renders
        // instead of silently producing no class.
        ink: {
          50:  '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#1A1612',
        },
        cream:   '#FAF7F2',
        warning: '#D97706',
        success: '#10B981',
      },
      fontSize: {
        // AGL canonical type scale. Pinned in px (not rem) so `@apply text-*`
        // inside component classes (.btn-primary, .kpi-value, .h-section, …)
        // compiles in the same value that the runtime override at the bottom
        // of index.css produces. Every step is the prior pass +1.5px so the
        // scale stays internally even.
        '2xs':  ['11.5px', { lineHeight: '15px'  }],
        'xs':   ['10.5px', { lineHeight: '1.4'   }],
        'sm':   ['11.5px', { lineHeight: '1.45'  }],
        'base': ['12.5px', { lineHeight: '1.5'   }],
        'lg':   ['13.5px', { lineHeight: '1.4'   }],
        'xl':   ['14.5px', { lineHeight: '1.35'  }],
        '2xl':  ['16.5px', { lineHeight: '1.3'   }],
        '3xl':  ['19.5px', { lineHeight: '1.25'  }],
        '4xl':  ['23.5px', { lineHeight: '1.2'   }],
        '5xl':  ['27.5px', { lineHeight: '1.15'  }],
        '6xl':  ['31.5px', { lineHeight: '1.1'   }],
      },
      // Canonical radius scale — capped at 14px.
      //   sm   → 6px chips
      //   md   → 8px buttons/inputs
      //   lg   → 10px segments/cards-tight
      //   xl   → 14px cards/modals
      // The legacy `control` (12) and `card` (16) tokens are retained for
      // backwards compatibility but should not be used in new markup.
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
        control: '12px',
        card: '16px',
      },
      // Canonical control heights so buttons / inputs / selects line up.
      height: {
        'control-xs': '28px',
        'control-sm': '32px',
        'control':    '36px',
        'control-lg': '44px',
      },
      letterSpacing: {
        luxe: '0.18em',
      },
      boxShadow: {
        card:      '0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)',
        elevated:  '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -4px rgba(0,0,0,0.08), 0 24px 48px -12px rgba(220,38,38,0.06)',
        floating:  '0 4px 16px -2px rgba(0,0,0,0.10), 0 16px 48px -8px rgba(0,0,0,0.14), 0 32px 80px -16px rgba(220,38,38,0.08)',
        pop:       '0 10px 30px -5px rgba(0,0,0,0.10), 0 4px 10px -2px rgba(0,0,0,0.05)',
      },
      fontFamily: {
        sans:  ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Cormorant Garamond', 'ui-serif', 'Georgia', 'serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}


/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        // GetWell Grow brand palette — derived from the logo
        brand: {
          teal: {
            50: "#E8F4F5",
            100: "#C7E5E7",
            200: "#93CACE",
            300: "#5FAFB5",
            400: "#3D979D",
            500: "#2A8A8F",
            600: "#237276",
            700: "#1C5A5E",
            800: "#154346",
            900: "#0E2C2E",
            950: "#071618",
            DEFAULT: "#2A8A8F",
          },
          orange: {
            50: "#FEF1E8",
            100: "#FDDDC4",
            200: "#FAB98A",
            300: "#F4A26A",
            400: "#EE874A",
            500: "#E8732C",
            600: "#C75D1F",
            700: "#9C4717",
            800: "#723311",
            900: "#4A210B",
            DEFAULT: "#E8732C",
          },
          pink: "#E89AB0",
          leaf: "#8FC079",
          ocean: "#4FB3D9",
          navy: "#0F2A44",
          sand: "#F8EFE2",
        },
        // Override tailwind teal so existing teal-* utilities pick up brand teal
        teal: {
          50: "#E8F4F5",
          100: "#C7E5E7",
          200: "#93CACE",
          300: "#5FAFB5",
          400: "#3D979D",
          500: "#2A8A8F",
          600: "#237276",
          700: "#1C5A5E",
          800: "#154346",
          900: "#0E2C2E",
          950: "#071618",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
          '2xl': '6rem',
        },
        screens: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1536px',
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

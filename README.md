# FRC Fantasy

A fantasy team builder app for FIRST Robotics Competition (FRC) events.

## Configuration

The app can be configured to use different FRC events:

### Switching Between Events

1. Open `app/utils/globals.ts`
2. To switch between events, change the `ACTIVE_CONFIG` line:
   ```typescript
   // For Ontario Provincial Championship:
   export const ACTIVE_CONFIG = ONTARIO_PROVINCIALS_CONFIG;

   // For FIRST Championship (Worlds):
   export const ACTIVE_CONFIG = WORLDS_CONFIG;
   ```
3. After changing the configuration, run the admin API to cache teams:
   ```bash
   curl -X POST http://localhost:3000/api/admin/cache-divisions
   ```

### Event Configurations

The app includes configurations for:

1. **Ontario Provincial Championship (2025)**
   - Two divisions: Division 1 and Division 2
   - Event dates: April 3rd to April 5th, 2025
   - Location: Mississauga, ON, Canada

2. **FIRST Championship - Houston (2025)**
   - One overall division
   - Event dates: April 16th to April 19th, 2025
   - Location: Houston, TX, USA

### Adding New Events

To add new events:

1. Add a new event configuration in `app/utils/globals.ts`
2. Update the `EVENT_NAME_MAP` to include names for your new event divisions
3. Set `ACTIVE_CONFIG` to your new configuration
4. Run the cache API to fetch teams for the new events

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

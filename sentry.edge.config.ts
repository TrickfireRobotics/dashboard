import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: "https://a1b56f6c70f602a20d90fbfd367e93d2@o4511577249021952.ingest.us.sentry.io/4511577305317376",
    tracesSampleRate: 1,
    enableLogs: true,
    sendDefaultPii: true,
});

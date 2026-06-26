# Google Search Console to Netlify Analytics Setup

This guide explains how to connect Google Search Console data to a Netlify-hosted website admin or analytics dashboard using a Google Cloud service account.

Use this when a dashboard shows messages such as:

- `Search Console not connected`
- `Google Clicks —`
- `Google CTR —`
- `Google Search Console API has not been used in project ... before or it is disabled`

## What This Connection Does

The website backend uses a Google service account to read Search Console performance data through the Google Search Console API.

This allows the admin dashboard to show data such as:

- Google clicks
- Google impressions
- CTR
- Average position
- Top search queries
- Top landing pages

The service account should be read-only. It does not need permission to edit the website or deploy code.

## Overview

The connection has four parts:

1. Google Cloud project
2. Google Cloud service account and JSON key
3. Google Search Console user access
4. Netlify environment variables

The flow is:

```txt
Google Cloud service account
        ↓ added as a user
Google Search Console property
        ↓ credentials stored in
Netlify environment variables
        ↓ read by
Netlify function / admin analytics dashboard
```

## Step 1: Confirm The Search Console Property

Open Google Search Console:

```txt
https://search.google.com/search-console
```

Select the property for the site.

There are two common property formats:

```txt
https://example.com/
```

or:

```txt
sc-domain:example.com
```

The value you use later for `GOOGLE_SEARCH_CONSOLE_SITE_URL` must match the Search Console property where you add the service account.

For a URL-prefix property, use:

```txt
GOOGLE_SEARCH_CONSOLE_SITE_URL=https://example.com/
```

For a domain property, use:

```txt
GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:example.com
```

## Step 2: Create Or Select A Google Cloud Project

Open Google Cloud Console:

```txt
https://console.cloud.google.com/
```

Create a clear project name, for example:

```txt
Example Site Search Console
```

You can use an existing project, but a dedicated project is easier to manage and safer for client work.

## Step 3: Enable The Search Console API

In Google Cloud, open:

```txt
APIs & Services → Library
```

Search for:

```txt
Google Search Console API
```

Open it and click:

```txt
Enable
```

Direct URL format:

```txt
https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview?project=PROJECT_ID
```

Replace `PROJECT_ID` with the Google Cloud project ID if needed.

Important: enabling the API can take a few minutes to propagate.

## Step 4: Create The Service Account

In Google Cloud, go to:

```txt
IAM & Admin → Service Accounts
```

Click:

```txt
Create service account
```

Recommended values:

```txt
Service account name: Example Site Search Console
Service account ID: example-site-search-console
Description: Read Search Console data for the website analytics dashboard
```

Click:

```txt
Create and continue
```

When Google asks for project permissions, leave the role blank.

Click:

```txt
Continue
```

When Google asks for principals with access, leave it blank.

Click:

```txt
Done
```

Why no Google Cloud role is needed:

The service account does not need permission to manage Google Cloud resources. It only needs access to Search Console, which is granted separately inside Search Console.

## Step 5: Create The JSON Key

After creating the service account:

1. Open `IAM & Admin → Service Accounts`.
2. Click the service account email.
3. Open the `Keys` tab.
4. Click `Add key`.
5. Click `Create new key`.
6. Select `JSON`.
7. Click `Create`.

Google will download a `.json` file.

Do not commit this file to GitHub.
Do not upload it to the website.
Do not paste the full key into chat tools.

The JSON contains the two values needed by Netlify:

```json
{
  "client_email": "example-site-search-console@example-project.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
}
```

## Step 6: Add The Service Account To Search Console

Go back to Google Search Console:

```txt
https://search.google.com/search-console
```

Select the property for the website.

Go to:

```txt
Settings → Users and permissions
```

Click:

```txt
Add user
```

Paste the service account email from the JSON file:

```txt
client_email
```

Example:

```txt
example-site-search-console@example-project.iam.gserviceaccount.com
```

Choose:

```txt
Restricted
```

Click:

```txt
Add
```

Restricted access is normally enough for reading Search Console analytics through the API.

## Step 7: Add Netlify Environment Variables

Open Netlify and select the site.

Go to:

```txt
Site configuration → Environment variables
```

Add:

```txt
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
GOOGLE_SEARCH_CONSOLE_SITE_URL
```

Use these values:

```txt
GOOGLE_SERVICE_ACCOUNT_EMAIL=client_email from the JSON file
GOOGLE_PRIVATE_KEY=private_key from the JSON file
GOOGLE_SEARCH_CONSOLE_SITE_URL=the exact Search Console property value
```

Example for a URL-prefix property:

```txt
GOOGLE_SEARCH_CONSOLE_SITE_URL=https://example.com/
```

Example for a domain property:

```txt
GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:example.com
```

## Step 8: Mark Secret Values

Mark these as secret in Netlify:

```txt
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
```

The most important one is:

```txt
GOOGLE_PRIVATE_KEY
```

This one does not need to be secret:

```txt
GOOGLE_SEARCH_CONSOLE_SITE_URL
```

It is just the Search Console property name. It is still safe if you mark it as secret, but it is not sensitive.

## Step 9: Private Key Formatting

Include the full private key, including:

```txt
-----BEGIN PRIVATE KEY-----
```

and:

```txt
-----END PRIVATE KEY-----
```

If Netlify stores it as one line with `\n` characters, that is fine. The site code should convert `\n` into line breaks before signing the Google API request.

Example:

```txt
-----BEGIN PRIVATE KEY-----\nABC123...\n-----END PRIVATE KEY-----\n
```

## Step 10: Redeploy The Site

After adding or changing Netlify environment variables, redeploy the site.

In Netlify:

```txt
Deploys → Trigger deploy → Deploy site
```

Wait for the deploy to finish.

Then open the admin analytics page.

## Step 11: Verify The Connection

Open the website analytics/admin page.

The Search Console section should show:

- Google clicks
- Google CTR
- Top queries
- Top pages

Search Console data is delayed. It is normal for the latest 1-2 days to be missing.

## Troubleshooting

### Error: Search Console API Has Not Been Used Or Is Disabled

Example:

```txt
Google Search Console API has not been used in project ... before or it is disabled.
```

Fix:

1. Open Google Cloud Console.
2. Select the same project used by the service account.
3. Go to `APIs & Services → Library`.
4. Search for `Google Search Console API`.
5. Click `Enable`.
6. Wait a few minutes.
7. Refresh the analytics page.

### Error: 403 Permission Denied

Likely causes:

- The service account was not added to Search Console.
- The wrong Search Console property was used.
- `GOOGLE_SEARCH_CONSOLE_SITE_URL` does not match the Search Console property exactly.

Check:

```txt
Settings → Users and permissions
```

in Search Console and confirm the service account email is listed.

Then check the Netlify variable:

```txt
GOOGLE_SEARCH_CONSOLE_SITE_URL
```

It must match the Search Console property.

### URL-Prefix vs Domain Property Mismatch

If Search Console shows:

```txt
https://example.com/
```

use:

```txt
GOOGLE_SEARCH_CONSOLE_SITE_URL=https://example.com/
```

If Search Console shows a domain property:

```txt
example.com
```

the API value is usually:

```txt
GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:example.com
```

### Error: Invalid Private Key

Likely causes:

- Missing `-----BEGIN PRIVATE KEY-----`
- Missing `-----END PRIVATE KEY-----`
- Extra quotes copied into Netlify
- Broken line breaks
- Only part of the key was copied

Fix:

Copy the complete `private_key` value from the JSON file.

### Error: Credentials Not Configured

Check Netlify has these variables:

```txt
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
GOOGLE_SEARCH_CONSOLE_SITE_URL
```

Then redeploy the site.

### Data Still Shows Blank

Possible causes:

- Search Console has no data yet.
- The selected date range has no clicks.
- The wrong property was connected.
- The site was just launched and Search Console has not processed data yet.

Search Console performance data is not real time.

## Security Notes

- Never commit the JSON key file.
- Never paste the full private key into public systems.
- Store `GOOGLE_PRIVATE_KEY` as a Netlify secret.
- Use Restricted Search Console access unless Full access is truly needed.
- If the JSON key is exposed, delete it in Google Cloud and create a new one.

## Reusing This For Another Project

For each new website:

1. Create or select a Google Cloud project.
2. Enable the Google Search Console API.
3. Create a service account.
4. Create a JSON key.
5. Add the service account email to that site's Search Console property.
6. Add the three Netlify environment variables to that site's Netlify project.
7. Redeploy.
8. Verify the analytics dashboard.

Use project-specific naming:

```txt
Client Name Search Console
client-name-search-console
client-name-search-console@project-id.iam.gserviceaccount.com
```

## Beyond RV Values

For Beyond RV, the likely Search Console URL-prefix value is:

```txt
GOOGLE_SEARCH_CONSOLE_SITE_URL=https://beyondrv.com.au/
```

If using a domain property instead, use:

```txt
GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:beyondrv.com.au
```

Use only the one that matches the Search Console property where the service account was added.

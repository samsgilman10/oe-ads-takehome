# Sam Gilman's OpenEvidence Ads Takehome

An application that shows users relevant ads when they ask questions to an LLM.

## Quickstart

"Production" Application: https://oe-ads-takehome-sam-gilmans-projects.vercel.app/

The application comes seeded with a few examples to demonstrate its capabilities. Try asking a question on "cancer", "diabetes", or "covid" and you should see an ad for a specific company.

## Overview

This application classifies incoming questions according to a dynamic set of categories, determines which partner owns the ad rights to that category, and allows that partner to serve an ad of its choosing using an `iframe`. It is a Next.js application using Prisma as an ORM to talk to a Postgres database, and it is deployed in "production" with Vercel.

### Data Models

There are three data models that drive application behavior: `Category`, `Partner` and `Question`.

- A `Partner` is a third-party that may buy the rights to serve ads for one or many categories
- A `Category` is used to classify questions
- A `Question` is a user-inputted question into the application

### Classification

When a question is entered, the application gathers every category present in the database as well as an additional option of "Uncategorized". It then poses a classification question to an unrefined OpenAI LLM using the OpenAI API's structured outputs [functionality](https://platform.openai.com/docs/guides/structured-outputs) to ensure the LLM responds with one of the categories. 

See `app/api/ads/route.ts` for more details.

### Ad Serving

Once a specific category has been selected, the application finds that partner associated with that category and returns the ad tag URL saved for that partner, which should point to a server where the partner can decide which ads to serve. Back on the client, that URL is inputted into an `iframe` with some query params to indicate the category. The `iframe` is shown while the overall answer is loading.

> Note: To simulate a real scenario where answering takes longer than classification due to the RAG work, the `ask` endpoint is set up with a 5 second delay.

In the seed data, both "Pfizer" and "Eli Lilly" are set up with working mock ad tags that point to a static server deployed from [this repository](https://github.com/samsgilman10/oe-ads-external-server) using Github Pages. This is just to show that it works, in practice we would point to some real server the partner already has set up, as it seems like this is standard practice in the ad industry. In the unlikely event that we were working with some very small partner with no prior advertising experience, we could relatively easily help them spin up a static server like the one linked above to serve basic ads.

### Configuration

The application is set up so that both the categories and partners are configurable. You can add new categories and partners and change the assignment of categories. Note that you should not delete either categories or partners to maintain referential integrity and data history (you will actually be blocked from doing so if there have been any questions associated with that category/partner). To remove a category from the classification you can mark it as `{active: false}`.

The easiest way to edit data is using [Prisma Studio](https://www.prisma.io/docs/orm/tools/prisma-studio). Once you've followed the [local dev setup instructions](#local-dev), you can access prisma studio locally:

```
npx prisma studio
```

Or in "production":

```
DATABASE_URL=<production_database_url> npx prisma studio
```

### Metrics
For each question asked, along with the question and answer we store data including which category and partner it was assigned to, links back to the question history, and (approximate) timestamps for when it was asked, classified, and answered. This data should be useful for us (e.g. for billing or performance monitoring) and for our partners (e.g. for impression tracking). Additionally, since the ads are served by the partners themselves, they should have access to their full suite of metrics from their ad service.

An example query to see the number of ads run by category for a partner over the last `n` days has been written in `metrics/ad_counts.sql`, which you can run by following the commands below. Be sure to be careful with timezones:

```
psql <database_url>
>>>> \i metrics/ad_counts.sql
>>>> EXECUTE ad_counts(<partner_id>, now() - INTERVAL '<n> DAYS', now());
```

### Deployment

The application is [deployed](https://nextjs.org/learn-pages-router/basics/deploying-nextjs-app/deploy) to "production" using the Vercel free tier. The database is similarly deployed using the Vercel free tier (which uses Supabase under the hood). Defaults were used in all cases, and the only configuration necessary is adding the `OPENAI_API_KEY` and `DATABASE_URL` environment variables.

Changes to the `main` branch of this repository triggers a new deploy. In order to facilitate testing and avoid data migration headaches the database is automatically wiped and re-seeded every time the application is deployed by the `postinstall` hook in `package.json`. Please see `prisma/seed.ts` for more details on the seed data.

## Future Work

> Note on deadline: I wanted to create an MVP (emphasis on the "M") that met basic requirements while providing the framework for future improvements. I was planning on turning it in whenever I got to that point, which I was aiming to do on Monday 11/4.

The application works, but there's still much more we could do. A non-exhaustive list of some of the most important things is below:

### Functional

- User Management
  - Sign up, login, logout, password reset, etc
  - We could also use this for internal and partner users to control access to a configuration UI or metrics UI (see below)
- Configuration UI
  - We shouldn't have to use a developer tool to configure the categories/partners. We should be able to build something that allows configuration via a UI
- Metrics Platform
  - Similarly, we should be able to have some UI for metrics that doesn't require developers to run SQL for simple queries
- Holisitic Ad Support
  - Shorter term, I would want to make sure that all partners' needs are met. That might mean sharing more data, integrating with SSPs more directly, or many other things
  - Eventually, we would maybe move beyond the paradigm of an assigned customer per category and allow runtime bids for different questions, perhaps using ad manager
  - In all cases we would need to think more on the tradeoff between ad optimality and privacy; I'm not exactly sure what the right amount of data to be sharing with partners is

### Non-functional

- Testing
  - I didn't write any tests because I didn't get to the point where I thought they would be helpful for my development. Once this got larger I would want to start writing some, mainly focusing integration tests. For example I would write tests for each of the three endpoints.
- CI/CD
  - I would want to set up automated tests and temporary test environments in CI, merge rules to main, different branches for `main`, `staging`, and `prod`, etc.
- Security
  - We're relying heavily on Vercel's security mechanisms which are hopefully pretty good. Even then I don't like having the DB publicly accessible, I'd want to control the IPs that had access to that ideally
  - I also don't like the uncontrolled DB access for configuration or metrics; I'd want to limit access to necessary tables for both and make it read only for metrics.
  - I don't know what the optimal level of security is for the `iframe` ads, but I'm guessing there's more we could do there
  - There would be more security work if/when we introduced user management
- Monitoring
  - Normal metrics on response times, page load, etc.
  - Automated alerts set up if categorization or answering started failing frequently
  - Cost tracking for categorization and question answering
- Performance
  - We might eventually want to split out the API to a different server to handle load better
  - I'm not convinced the DB connection is set up optimally
  - The classification actually seems pretty good with the regular LLM (at least with only a few categories), but we could fine-tune a model for improved classification, or perhaps try using vector embeddings. In either case we would need training data
    - Relatedly, we also might want some data to show partners to assure them that the classification is actually working well and their ads are being put to good use

## <a name="local-dev"></a> Local Development
This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

### Setup

Prior to running the application, you will need to have some Postgres database set up to use (either locally or remotely). Once you have that, set the `DATABASE_URL` environment variable using a `.env` file and it will be automatically detected by prisma. You will also need the `OPENAI_API_KEY` environment variable, but that does not need to be in the `.env` file.

Lastly, you will need to run `npm install` and `prisma generate` before starting the dev server.

### Run

Run the development server:

```bash
OPENAI_API_KEY=KEY npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
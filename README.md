# Loss Run Pro

Copy my another project Insight Navigator, I want to build a loss run extraction platform with generic line of business use cases. I need additional functions, 

1. Team management tab for admin to choose which template user can access to, with respect to insurance line of business

2. Every user has a historical record management to know what files have been uploaded, what metadata to be extracted, timestamp, under which client etc

3. Loss Runs reconciliation, and highlight data quality issue in output

4. Output to be in excel downloadable format

5. User can upload a template and modify the extracted fields and claim it is the source of truth, in order to produce golden source of truth.

6. After user upload documents , AI will extract all related fields for processing a loss runs for modelling, pricing, risk analysis, then user can select which to be exported in excel.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://golden-loss-tamer.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a36e5c93-d80c-43b0-acf7-36e48f8b511b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

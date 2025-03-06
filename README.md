# DSC-180B-B16--Group1

Please follow the step below for reproduction.

1. Be noticed, the files we shared inside repo for frontend is not sufficient to reproduce the project, those are for code reference only. because our folder is too large for the github repo, so we have to share the complete file using google drive link, Please download the folder here: (It may take you 5-10 minutes to download)
- https://drive.google.com/drive/folders/1Rejashr-dkWUFynzehHpEyZGbv6Yrteu?usp=drive_link

2. Then, go to the directory `pinata-nextjs` in the terminal, making sure you have python 3.7 - python 3.12 (spacy is incompatible as of now with python 3.13), run `rm -rf node_modules`, then `rm -rf package-lock.json`, then run `npm install`，run `pip install spacy` and `python -m spacy download en_core_web_sm`, finally run `npm run dev`, you should be able to see the page at http://localhost:3000/
3. Once the local server is setup, it is important to setup Metamask
- Use this link: https://support.metamask.io/start/getting-started-with-metamask/
4. Next, we have to connect to amoy testnet.
- https://polygon.technology/blog/introducing-the-amoy-testnet-for-polygon-pos
5. Once configured, use this faucet to get tokens.
- https://faucet.polygon.technology/
6. When paying for transactions, make sure to set the priority fee and max base fee to 35gwei & 40gwei respectively.
- https://support.metamask.io/configure/transactions/how-to-customize-gas-settings/
  


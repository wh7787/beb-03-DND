import Caver from "caver-js";
import { nftABI, nftAddress } from "../features/marketplace/nftContractInfo";

export const getOwnedWeapons = (address) => {
  return new Promise(async (resolve, reject) => {
    try {
      const caver = new Caver(window.klaytn);
      const nft = new caver.klay.Contract(nftABI, nftAddress);
      const totalSupply = await nft.methods.totalSupply().call();

      let tempList = [];

      for (let i = 1; i <= totalSupply; i++) {
        const owner = await nft.methods.ownerOf(i).call();
        if (owner.toLowerCase() === address.toLowerCase()) {
          const weapon = await nft.methods.weapons(i - 1).call();
          tempList.push({
            dna: weapon.weaponType,
            lvl: weapon.weaponLevel,
            id: i,
          });
        }
      }

      resolve(tempList);
    } catch (err) {
      reject(err);
    }
  });
};
import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import Caver from "caver-js";
import { closeTokenSwapModal } from "../modal/tokenSwapModalSlice";
import TokenSelectModal from "./TokenSelectModal";
import { openSubModal, clearState } from "./tokenSwapSlice";
import { startLoading, stopLoading } from "../loading/loadingSlice";
import { Modal, Container, Header, Button } from "../../styles/Modal.styled";
import { ModalCenter } from "../../styles/ModalCenter.styled";
import {
  InputContainer,
  BalanceContainer,
} from "../../styles/InputContainer.styled";
import {
  SwapInfoContainer,
  InfoContainer,
} from "../../styles/TokenSwap.styled";
import { factoryABI, factoryAddress, exchangeABI } from "../dex/contractInfo";

const TokenSwapModal = () => {
  const dispatch = useDispatch();
  const { isSubModalOpen, tokens, token0, token1 } = useSelector(
    (state) => state.tokenSwap
  );
  const { exchanges } = useSelector((state) => state.dex);
  const [balance, setBalance] = useState(0);
  const [balance1, setBalance1] = useState(0);
  const [account, setAccount] = useState(null);
  const [selectedToken, setSelectedToken] = useState(0);
  const token0InputRef = useRef(null);
  const token1InputRef = useRef(null);
  const [exchange, setExchange] = useState({});
  const [minOutput, setMinOutput] = useState(0);
  const [price, setPrice] = useState("");

  const connectToWallet = async () => {
    if (typeof window.klaytn !== "undefined") {
      const provider = window["klaytn"];
      try {
        const accounts = await window.klaytn.enable();
        const _account = window.klaytn.selectedAddress;
        setAccount(_account);

        const caver = new Caver(window.klaytn);
        const _balance = await caver.klay.getBalance(_account);
        setBalance(caver.utils.fromPeb(_balance));
      } catch (err) {
        console.log(err);
      }
    }
  };

  /*
   * 현재 보유중인 전체 수량을 input으로 넣어준다.
   */
  const inputMaxToken = () => {
    token0InputRef.current.value = balance;
  };

  /*
   *
   */
  const getOutputAmount = async () => {
    const caver = new Caver(window.klaytn);
    const input = token0InputRef.current.value || 0;
    // input field가 비어있는지 확인하고
    // 비어있지 않으면 블록체인에서 output amount를 가져온다.
    // 비어있다면 초기화한다.
    if (input > 0) {
      let output;
      // 토큰을 지불하려 한다면 output이 klay이기 때문에 getKlayAmount를 호출하고
      // 클레이를 지불하려 하면 output이 토큰이기 때문에 getTokenAmount를 호출한다.
      if (token0 > 0) {
        output = await exchange.methods
          .getKlayAmount(caver.utils.toPeb(input))
          .call();
      } else {
        output = await exchange.methods
          .getTokenAmount(caver.utils.toPeb(input))
          .call();
      }
      token1InputRef.current.value = Number(
        caver.utils.fromPeb(output)
      ).toFixed(6);
      setMinOutput(caver.utils.fromPeb(output) * 0.99);
    } else {
      token1InputRef.current.value = "";
      setMinOutput(0);
    }
    getPrice();
  };

  /*
   * 클레이와 토큰을 교환한다.
   */
  const swapToken = async () => {
    const caver = new Caver(window.klaytn);
    dispatch(startLoading());
    //만약 지불하는게 토큰이면 tokenToKlay 함수를 호출하고
    // 클레이를 지불한다면 klayToToken 함수를 호출한다.
    if (token0 > 0) {
      const tokenAddress = tokens[token0].address;
      const kip7 = new caver.klay.KIP7(tokenAddress);
      let exchangeAddress;

      for (let i = 0; i < exchanges.length; i++) {
        if (
          exchanges[i].tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
        ) {
          exchangeAddress = exchanges[i].address;
        }
      }
      const allowed = await kip7.allowance(account, exchangeAddress);
      // allowed가 적을경우에 approve 다시한다.
      if (allowed.toString() === "0") {
        try {
          await kip7.approve(exchangeAddress, caver.utils.toPeb("100000000"), {
            from: account,
          });
        } catch (err) {
          console.log(err);
        }
      }

      const input = token0InputRef.current.value;
      await exchange.methods
        .tokenToklaySwap(
          caver.utils.toPeb(input),
          caver.utils.toPeb(minOutput.toString())
        )
        .send({ from: account, gas: 20000000 });
      dispatch(stopLoading());
    } else {
      const input = token0InputRef.current.value;
      await exchange.methods
        .klayToTokenSwap(caver.utils.toPeb(minOutput.toString()))
        .send({
          from: account,
          value: caver.utils.toPeb(input),
          gas: 20000000,
        });

      dispatch(stopLoading());
      //만약 URU 토큰으로 교환을 한다면
      //카이카스에 URU 토큰을 등록해준다.
      if (tokens[token1].symbol === "URU") {
        const tokenAdded = localStorage.getItem("tokenAdded");
        console.log(tokenAdded);
        if (!tokenAdded) {
          window.klaytn.sendAsync(
            {
              method: "wallet_watchAsset",
              params: {
                type: "ERC20", // Initially only supports ERC20, but eventually more!
                options: {
                  address: tokens[token1].address, // The address that the token is at.
                  symbol: tokens[token1].symbol, // A ticker symbol or shorthand, up to 5 chars.
                  decimals: 18, // The number of decimals in the token
                  image: "", // A string url of the token logo
                },
              },
              id: Math.round(Math.random() * 100000),
            },
            (err, added) => {
              if (added) {
                console.log("Thanks for your interest!");
              } else {
                console.log("Your loss!");
              }
            }
          );
          localStorage.setItem("tokenAdded", "true");
        }
      }
    }
    getToken0();
    getToken1();
    token0InputRef.current.value = 0;
    token1InputRef.current.value = 0;
  };

  const getToken0 = async () => {
    const caver = new Caver(window.klaytn);
    if (token0 > 0) {
      const address = tokens[token0].address;
      const kip7 = new caver.klay.KIP7(address);
      const symbol = await kip7.symbol();
      const _balance = await kip7.balanceOf(account);
      setBalance(caver.utils.fromPeb(_balance));
      setExchangeContract(address);
    } else {
      const _balance = await caver.klay.getBalance(account);
      setBalance(caver.utils.fromPeb(_balance));
    }
  };

  const getToken1 = async () => {
    const caver = new Caver(window.klaytn);
    if (token1 > 0) {
      const address = tokens[token1].address;
      const kip7 = new caver.klay.KIP7(address);
      const _balance = await kip7.balanceOf(account);
      setBalance1(caver.utils.fromPeb(_balance));
      setExchangeContract(address);
    } else {
      const _balance = await caver.klay.getBalance(account);
      setBalance1(caver.utils.fromPeb(_balance));
    }
  };

  const setExchangeContract = (address) => {
    const caver = new Caver(window.klaytn);
    for (let i = 0; i < exchanges.length; i++) {
      if (exchanges[i].tokenAddress.toLowerCase() === address.toLowerCase()) {
        setExchange(new caver.klay.Contract(exchangeABI, exchanges[i].address));
      }
    }
  };

  const getPrice = () => {
    const t0 = token0InputRef.current.value;
    const t1 = token1InputRef.current.value;
    if (t0 === "" || t1 === "") {
      setPrice("");
    } else {
      setPrice((Number(t1) / Number(t0)).toFixed(6));
    }
  };

  useEffect(() => {
    if (account) {
      getToken0();
      getToken1();
    }
  }, [account, token0, token1]);

  return (
    <ModalCenter>
      {!isSubModalOpen && (
        <Modal>
          <Container>
            <Header>
              <h1>토큰 교환</h1>
              <button
                onClick={() => {
                  dispatch(closeTokenSwapModal());
                  dispatch(clearState());
                }}
              ></button>
            </Header>
            <button onClick={connectToWallet}>잔액조회</button>
            <InputContainer type='number'>
              <button
                onClick={() => {
                  dispatch(openSubModal());
                  setSelectedToken(0);
                }}
              >
                {tokens[token0].symbol}
                <img src='assets/arrowDown.png' />
              </button>
              <input
                placeholder='0.0'
                ref={token0InputRef}
                onChange={getOutputAmount}
              />
              <BalanceContainer>
                <div onClick={inputMaxToken}>Max</div>
                <span>
                  잔액: {Number(balance).toFixed(2)} {tokens[token0].symbol}
                </span>
              </BalanceContainer>
            </InputContainer>
            <button>스왑</button>
            <InputContainer type='number'>
              <button
                onClick={() => {
                  dispatch(openSubModal());
                  setSelectedToken(1);
                }}
              >
                {tokens[token1].symbol}
                <img src='assets/arrowDown.png' />
              </button>
              <input placeholder='0.0' disabled ref={token1InputRef} />

              <BalanceContainer>
                <span>
                  잔액:{" "}
                  {token1 < 0
                    ? "0.0"
                    : `${Number(balance1).toFixed(2)} ${tokens[token1].symbol}`}
                </span>
              </BalanceContainer>
            </InputContainer>
            <SwapInfoContainer>
              {price && (
                <InfoContainer>
                  <span>가격</span>
                  <span>
                    {price} {tokens[token1].symbol} per {tokens[token0].symbol}{" "}
                  </span>
                </InfoContainer>
              )}
              <InfoContainer>
                <span>Slippage 허용</span>
                <span>1%</span>
              </InfoContainer>
              <InfoContainer>
                <span>최소 수령</span>
                <span>{minOutput.toFixed(6)}</span>
              </InfoContainer>
            </SwapInfoContainer>
            <Button onClick={swapToken}>교환</Button>
          </Container>
        </Modal>
      )}
      {isSubModalOpen && (
        <TokenSelectModal
          selectedToken={selectedToken}
          setExchangeContract={setExchangeContract}
        />
      )}
    </ModalCenter>
  );
};

export default TokenSwapModal;

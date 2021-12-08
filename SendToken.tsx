import React, { FC, useCallback } from 'react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction, Signer } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { styled } from '@mui/material/styles';

import {
  Dialog,
  Button,
  ButtonGroup,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  FormHelperText,
  Avatar,
  Grid,
  Paper,
  Typography
} from '@mui/material';

import { useSnackbar } from 'notistack';

import HelpIcon from '@mui/icons-material/Help';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight';

function trimAddress(addr: string) {
    if (!addr) return addr;
    let start = addr.substring(0, 8);
    let end = addr.substring(addr.length - 4);
    return `${start}...${end}`;
}

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  '& .MuDialogContent-root': {
    padding: theme.spacing(2),
  },
  '& .MuDialogActions-root': {
    padding: theme.spacing(1),
  },
}));

export interface DialogTitleProps {
  id: string;
  children?: React.ReactNode;
  onClose: () => void;
}

const BootstrapDialogTitle = (props: DialogTitleProps) => {
  const { children, onClose, ...other } = props;

  return (
    <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
      {children}
      {onClose ? (
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      ) : null}
    </DialogTitle>
  );
};

export default function SendToken(props: any) {
    const [open, setOpen] = React.useState(false);
    const [amounttosend, setTokensToSend] = React.useState(null);
    const [toaddress, setToAddress] = React.useState(null);
    const [userTokenBalanceInput, setTokenBalanceInput] = React.useState(0);
    const [convertedAmountValue, setConvertedAmountValue] = React.useState(null);
    const mint = props.mint;
    const logoURI = props.logoURI;
    const name = props.name;
    const balance = props.balance;
    const conversionrate = props.conversionrate;
    const { connection } = useConnection();
    const { publicKey, wallet, sendTransaction } = useWallet();
    const { enqueueSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );
    const handleClickOpen = () => {
        setOpen(true);
    };
    const handleClose = () => {
        setOpen(false);
    };

    async function transferTokens(tokenMintAddress: string, to: string, amount: number) {
        const fromWallet = publicKey;
        const toWallet = new PublicKey(toaddress);
        const mintPubkey = new PublicKey(tokenMintAddress);
        const amountToSend = +amounttosend;
        const tokenAccount = new PublicKey(mintPubkey);
        
        if (tokenMintAddress == "So11111111111111111111111111111111111111112"){ // Check if SOL
            const decimals = 9;
            const adjustedAmountToSend = amountToSend * Math.pow(10, decimals);
            const transaction = new Transaction()
            .add(
                SystemProgram.transfer({
                    fromPubkey: fromWallet,
                    toPubkey: toWallet,
                    lamports: adjustedAmountToSend,
                })
            );
            
            enqueueSnackbar(`Preparing to send ${amountToSend} ${name} to ${toaddress}`,{ variant: 'info' });
            const signature = await sendTransaction(transaction, connection);
            enqueueSnackbar(`Transaction ready`,{ variant: 'info' });
            await connection.confirmTransaction(signature, 'processed');
            enqueueSnackbar(`Sent ${amountToSend} ${name} to ${toaddress}`,{ variant: 'success' });
        } else{
            const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
            const accountParsed = JSON.parse(JSON.stringify(accountInfo.value.data));
            const decimals = accountParsed.parsed.info.decimals;

            let fromAta = await Token.getAssociatedTokenAddress( // calculate from ATA
                ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
                TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
                mintPubkey, // mint
                fromWallet // from owner
            );
            
            let toAta = await Token.getAssociatedTokenAddress( // calculate to ATA
                ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
                TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
                mintPubkey, // mint
                toWallet // to owner
            );
            
            const adjustedAmountToSend = amountToSend * Math.pow(10, decimals);
            const receiverAccount = await connection.getAccountInfo(toAta);

            if (receiverAccount === null) { // initialize token
                const transaction = new Transaction()
                .add(
                    Token.createAssociatedTokenAccountInstruction(
                        ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
                        TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
                        mintPubkey, // mint
                        toAta, // ata
                        toWallet, // owner of token account
                        fromWallet // fee payer
                    )
                )
                .add(
                    Token.createTransferInstruction(
                        TOKEN_PROGRAM_ID,
                        fromAta,
                        toAta,
                        publicKey,
                        [],
                        adjustedAmountToSend,
                    )
                );
                
                enqueueSnackbar(`Preparing to send ${amountToSend} ${name} to ${toaddress}`,{ variant: 'info' });
                const signature = await sendTransaction(transaction, connection);
                enqueueSnackbar(`Transaction ready`,{ variant: 'info' });
                await connection.confirmTransaction(signature, 'processed');
                enqueueSnackbar(`Sent ${amountToSend} ${name} to ${toaddress}`,{ variant: 'success' });
            } else{ // token already in wallet
                const transaction = new Transaction().add(
                    Token.createTransferInstruction(
                    TOKEN_PROGRAM_ID,
                    fromAta,
                    toAta,
                    publicKey,
                    [],
                    adjustedAmountToSend,
                    )
                );
                
                enqueueSnackbar(`Preparing to send ${amountToSend} ${name} to ${toaddress}`,{ variant: 'info' });
                const signature = await sendTransaction(transaction, connection);
                enqueueSnackbar(`Transaction ready`,{ variant: 'info' });
                await connection.confirmTransaction(signature, 'processed');
                enqueueSnackbar(`Sent ${amountToSend} ${name} to ${toaddress}`,{ variant: 'success' });
            }
        }
    }
    
    function HandleSendSubmit(event: any) {
        event.preventDefault();
        if (amounttosend > 0){
            if (toaddress){
                if ((toaddress.length >= 32) && 
                    (toaddress.length <= 44)){ // very basic check / remove and add twitter handle support (handles are not bs58)
                    transferTokens(mint, toaddress, amounttosend);
                    handleClose();
                } else{
                    // Invalid Wallet ID
                    enqueueSnackbar(`Enter a valid Wallet Address!`,{ variant: 'error' });
                    console.log("INVALID WALLET ID");
                }
            } else{
                enqueueSnackbar(`Enter a valid Wallet Address!`,{ variant: 'error' });
            }
        }else{
            enqueueSnackbar(`Enter the balance you would like to send`,{ variant: 'error' });
        }
    }

    React.useEffect(() => {
         setConvertedAmountValue(amounttosend*conversionrate);
    }, [amounttosend]);
    
    return (
        <div>
            <Button
                variant="outlined" 
                //aria-controls={menuId}
                title={`Send ${name}`}
                onClick={handleClickOpen}
                size="small"
                //onClick={isConnected ? handleProfileMenuOpen : handleOpen}
                >
                <ArrowCircleRightIcon sx={{mr:1}} /> {name}
            </Button>
        <BootstrapDialog
            onClose={handleClose}
            aria-labelledby="customized-dialog-title"
            open={open}
            PaperProps={{ 
                style: {
                    background: 'linear-gradient(to right, #251a3a, #000000)',
                    boxShadow: '3',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderTop: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '20px',
                    padding:'4'
                    },
                }}
        >
            <form onSubmit={HandleSendSubmit}>
                <BootstrapDialogTitle id="customized-dialog-title" onClose={handleClose}>
                    Send {name}
                </BootstrapDialogTitle>
                <DialogContent dividers>
                    <FormControl>
                        <Grid container spacing={2}>
                            <Grid item xs={4}>
                                
                            <Grid container direction="row" alignItems="center">
                                <Grid item>
                                    {logoURI ? 
                                        <Avatar component={Paper} 
                                            elevation={4}
                                            alt="Token" 
                                            src={logoURI}
                                            sx={{ width: 28, height: 28, bgcolor: "#222" }}
                                        /> : <HelpIcon />}
                                </Grid>
                                <Grid item sx={{ ml: 1 }}>
                                    {name || (mint && trimAddress(mint)) || ''}
                                </Grid>
                            </Grid>
                            </Grid>
                            <Grid item xs={8}>
                                <TextField 
                                    id="send-token-amount" 
                                    fullWidth 
                                    placeholder="0.00" 
                                    variant="standard" 
                                    autoComplete="off"
                                    value={userTokenBalanceInput}
                                    type="number"
                                    onChange={(e) => {
                                        setTokensToSend(e.target.value)
                                        setTokenBalanceInput(+e.target.value)
                                        }
                                    }
                                    InputProps={{
                                        inputProps: {
                                            style: {
                                                textAlign:'right'
                                            }
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <Typography
                                    variant="caption"
                                >
                                    Balance: {balance} 
                                    <ButtonGroup variant="text" size="small" aria-label="outlined primary button group" sx={{ml:1}}>
                                        <Button 
                                            onClick={() => {
                                                setTokensToSend(balance)
                                                setTokenBalanceInput(+balance) }}
                                        > 
                                            Max 
                                        </Button>
                                        <Button  
                                            onClick={() => {
                                                setTokensToSend(+balance/2)
                                                setTokenBalanceInput(+balance/2) }}
                                        > 
                                            Half
                                        </Button>
                                    </ButtonGroup>
                                </Typography>
                            </Grid>
                            <Grid item xs={6}
                                sx={{
                                    textAlign:'right'
                                }}
                            >
                                <Typography
                                    variant="caption"
                                >
                                    {convertedAmountValue &&
                                    <>
                                    ~ ${convertedAmountValue.toFixed(2)}
                                    </>
                                    }
                                </Typography>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField 
                                    id="send-to-address" 
                                    fullWidth 
                                    placeholder="Enter any Solana address" 
                                    label="To address" 
                                    variant="standard"
                                    autoComplete="off"
                                    onChange={(e) => {setToAddress(e.target.value)}}
                                    InputProps={{
                                        // step: 0.000000001, CONSIDER USING NUMBER TYPE (hide arrows with CSS)
                                        inputProps: {
                                            style: {
                                                textAlign:'center'
                                            }
                                        }
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button     
                        fullWidth
                        type="submit"
                        variant="outlined" 
                        title="Send"
                        sx={{
                            margin:1
                        }}>
                        Send
                    </Button>
                </DialogActions>
            </form>
        </BootstrapDialog>
        </div>
    );
}

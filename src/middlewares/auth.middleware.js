import { ApiError  } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "json-web-token"
import { User } from "../models/user.model.js";


export const verifyJWT = asyncHandler( async(req, _, next) =>{
   try {
     const token = req.cookies?.accessToken || req.header("Authorizarion")?.replace("Bearer ","")
 
     if(!token){
         throw new ApiError(401,"Unauthorizred request")
     }
 
     const decodedToken = jwt.verifY(token, process.env.ACCESS_TOKEN_SECRET)
 
     const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
 
     if(!user){
         throw new ApiError(401, "Invalid Access Token")
     }
 
     req.user = user;
     next();

   } catch (error) {
        throw new ApiError(401,error?.message || "Invalid access Token")
   }
})
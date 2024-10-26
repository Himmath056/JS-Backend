import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js" 
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken= user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})  // save to database

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong while gererating refresh and access token")
    }
} 

const registerUser = asyncHandler( async (req,res) =>{
    
    // get user details from frontend
    const {fullname , email, username , password}=req.body
    // console.log(req.body);
    
    // validation - not empty
    if(
        [fullname, email, username , password].some((field) => (
            field?.trim() === ""
        ))
    ){
        throw new ApiError(400,"All fields are required");
    }
    
    //  check if user already exits : username , email
    const existedUser = await User.findOne({
        $or: [{username} ,{email}]
    })
    
    if (existedUser) {
        throw new ApiError(409,"User with email or username already exits");
        
    }
    
    // console.log(req.files);
    
    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path 
    // const coverImageLocalPath = req.files?.coverImage[0]?.path
    
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length >0){
        coverImageLocalPath = req.files.coverImage[0].path   // if not found gives ""
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }
    
    // upload them to cloudinary , avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }
    
    // create user object - create entry in db
    const user = await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase(),
    })
    
    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    
    // check for user creation 
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user");
    }
    
    // return response
    return res.status(201).json(
        new ApiResponse(200, createdUser ,"User registered Successfully")
    )

})

const loginUser = asyncHandler( async (req,res) =>{
    // req body  -> data
    const {email, username , password} =req.body

    // username or email
    if(!username || !email){
        throw new ApiError(400, "username or email is required")
    }

    // find the user
    const user = await User.findOne({
        $or:[{username},{email}]
    })

    // not found
    if(!user){
        throw new ApiError(404, "user does not exits")
    }

    // password check
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user Credentials")
    }

    // access and refresh token 
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser =  User.findById(user._id).select("-password -refreshToken")

    //  send cookie
    const options = {  // server modifiable
        httpOnly: true,
        secure:true
    }

    // send respond 
    return res
    .status(200)
    .cookie("accessToken",accessToken, options)
    .cookie("refreshToken",refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser, accessToken, refreshToken
            },
            "user logged In Successfuly"
        )
    )
})


const logOutUser = asyncHandler( async (req,res) =>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set :{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    const options = {  // server modifiable
        httpOnly: true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json(new ApiResponse(200,{},"User logged Out"))
    
})
export {registerUser, loginUser, logOutUser}
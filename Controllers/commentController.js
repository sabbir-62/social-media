const mongoose = require('mongoose');
const Comment = require("../Models/commentModel");
const CommentReply = require("../Models/commentReplyModel");
const Post = require("../Models/postModel");
const ReplyInReply = require("../Models/replyInReplyModel");
const Notification = require("../Models/notificationModel");
const {
    clientError
} = require("./error");
const userProfileModel = require('../Models/user_profile_Model');
const cloudinary = require("../Helpers/Cloudinary");
const GeneralReaction = require('../Models/generalReactionModel');

// Function to upload a file to Cloudinary=======================
const uploadToCloudinary = async (file) => {
    try {
        const result = await cloudinary.uploader.upload(file.path, {
            resource_type: 'auto',
        });
        console.log('Cloudinary upload result:', result);
        return {
            public_id: result.public_id,
            secure_url: result.secure_url,
        };
    } catch (error) {
        console.error('Error uploading file to Cloudinary:', error);
        throw new Error(`Error uploading file to Cloudinary: ${error.message}`);
    }
};

// comment count updated =============================
const updateCommentCount = async (postId) => {
    try {
        
        const commentCount = await Comment.countDocuments({ postId });

        await Post.findByIdAndUpdate(postId, { commentCount });
        
        return true;
    } catch (error) {
        return false;
    }
};
// create comment ==========================================
const createComment = async (req, res) => {
    try {
        const {
            userId,
            postId,
            commentContent,
            postOwnerId,
        } = req.body;

        const user = await userProfileModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: 'failed',
                message: 'User not found',
            });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({
                status: 'failed',
                message: 'Post not found',
            });
        }

        const imgVideoFile = req.files['img_video'] ? req.files['img_video'][0] : null;

        // Check if at least one of content, image, or video is provided
        if (!commentContent && !imgVideoFile) {
            return res.status(400).json({
                status: 'Fail',
                message: 'At least one of content, image, or video is required',
            });
        }

        // Upload img_video to Cloudinary if it exists
        let imgVideoUploadResult = null;
        if (imgVideoFile) {
            try {
                imgVideoUploadResult = await uploadToCloudinary(imgVideoFile);
            } catch (uploadError) {
                return res.status(500).json({
                    status: 'Fail',
                    message: 'Error uploading img_video to Cloudinary',
                    uploadError,
                });
            }
        }

        // Create the comment object
        const newComment = await Comment({
            userId,
            postId,
            commentContent: commentContent ? commentContent : null,
            img_video: imgVideoUploadResult ? imgVideoUploadResult.secure_url : null,
        }).save();

        // update comment count==========
        await updateCommentCount(postId);

        const newNotification = new Notification({
            userId: postOwnerId,
            message: 'You have a new comment on your post.',
            type: 'Comment',
            senderId: userId,
        });

        await newNotification.save();

        // Add Comment on Post
        const posts = await Post.findById(postId);
        posts.comments.push(newComment);
        await posts.save();

        return res.status(201).json({
            status: 'Success',
            data: newComment,
        });
    } catch (error) {
        return res.status(500).json({
            status: 'Fail',
            message: 'Unexpected error',
        });
    }
};

// read Comment =============================================
const readComment = async (req, res) => {
    try {
        const id = req.params.id;

        // Validate that the provided ID is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: "Failed",
                message: "Invalid ID format",
            });
        }

        const commentRead = await Comment.findById(id).select('commentContent img_video').populate({
            path: 'commentReplies',
            select: 'commentReplyContent img_video', 
        });

        if (!commentRead) {
            return res.status(404).json({
                status: 'Failed',
                message: 'Comment not found',
            });
        }

        return res.status(200).json({
            status: "Success",
            data: commentRead,
        });

    } catch (error) {
        return res.status(500).json({
            status: "Failed",
            message: error.message,
        });
    }
};

// get all comments =====================================
const getAllComments = async (req, res) => {
    try {
      const comments = await Comment.find()
        .select('commentContent img_video') 
        .populate({
          path: 'commentReplies',
          select: 'commentReplyContent img_video', 
        });
  
      return res.status(200).json({
        status: "Success",
        data: comments,
      });
  
    } catch (error) {
      return res.status(500).json({
        status: "Failed",
        message: error.message,
      });
    }
};
  
// update Comment===============================================
const updateComment = async (req, res) => {
    try {
        const id = req.params.id;
        const {
            userId
        } = req.body;

        const comment = await Comment.findOne({
            _id: id,
            userId: userId,
        });

        if (!comment) {
            return await clientError(res, 404, 'Comment or user with this id was not found');
        }

        const img_videoFile = req.files['img_video'] ? req.files['img_video'][0] : null;

        const updateFields = {
            commentContent: req.body.commentContent ? req.body.commentContent : comment.commentContent || null,
            img_video: img_videoFile ? (await uploadToCloudinary(img_videoFile)).secure_url : comment.img_video || null,
        };

        const updatedCommentData = await Comment.updateOne({
            _id: id
        }, {
            $set: updateFields,
        }, {
            new: true
        });

        res.status(200).json({
            status: 'Success',
            updatedCommentData,
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

// comment delete =================================================
const deleteComment = async (req, res) => {
    try {
        const commentId = req.params.id;

        // Validate that the provided ID is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({
                status: "Failed",
                message: "Invalid ID format",
            });
        }

        // Find the associated post
        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({
                status: "Failed",
                message: "Comment not found",
            });
        }
        const postId = comment.postId;

        // Find all reactions associated with the comment, comment replies, and reply in replies
        const reactionsToDelete = await GeneralReaction.find({
            $or: [
                { targetType: 'Comment', targetId: commentId },
                { targetType: 'CommentReply', targetId: { $in: await CommentReply.find({ commentId: commentId }).distinct('_id') } },
                { targetType: 'ReplyInReply', targetId: { $in: await ReplyInReply.find({ commentId: commentId }).distinct('_id') } },
            ],
        });

        // Delete the reactions
        await GeneralReaction.deleteMany({ _id: { $in: reactionsToDelete.map(reaction => reaction._id) } });

        // Delete Comment
        await Comment.deleteOne({
            _id: commentId
        });

        // Delete associated CommentReply documents
        await CommentReply.deleteMany({
            commentId: commentId
        });

        // Delete associated ReplyInReply documents
        await ReplyInReply.deleteMany({
            commentId: commentId
        });

        // Remove comment from the associated post
        await Post.findByIdAndUpdate(
            postId,
            {
                $pull: { comments: commentId } 
            },
            { new: true }
        );

        // update comment count
        await updateCommentCount(postId);

        return res.status(200).json({
            status: "Success",
            message: "Comment and associated replies deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            status: "Failed",
            message: error.message,
        });
    }
};


module.exports = {
    createComment,
    readComment,
    getAllComments,
    updateComment,
    deleteComment
}